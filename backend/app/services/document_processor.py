"""
Document processing pipeline (synopsis Module 3).

Flow: load raw file -> extract text -> chunk (Recursive splitter,
1000 chars / 200 overlap) -> embed -> store in ChromaDB with metadata
-> update the document's processing_status in PostgreSQL.
"""

import uuid

from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document
from app.services import vector_store


# ---------- OCR (scanned / image-only PDFs) ----------
# RapidOCR is heavy to construct (loads onnx models), so build it once and
# reuse it across documents.
_ocr_engine = None


def _get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR()
    return _ocr_engine


def _ocr_pdf_pages(path: str, page_indices: list[int]) -> dict[int, str]:
    """OCR the given 0-based page indices of a PDF. Renders each page to an
    image with PyMuPDF and reads it with RapidOCR. Returns {index: text}."""
    import fitz  # PyMuPDF
    import numpy as np
    from PIL import Image

    engine = _get_ocr_engine()
    zoom = settings.OCR_DPI / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    out: dict[int, str] = {}
    doc = fitz.open(path)
    try:
        for idx in page_indices[: settings.OCR_MAX_PAGES]:
            pix = doc[idx].get_pixmap(matrix=matrix, alpha=False)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            result, _ = engine(np.array(img))
            # result is a list of [box, text, score]; keep the recognized text.
            out[idx] = "\n".join(line[1] for line in result) if result else ""
    finally:
        doc.close()
    return out


# ---------- Text extraction ----------
def _extract_pdf(path: str) -> list[tuple[int, str]]:
    """Return (page_number, text) for each page. Pages with no embedded
    (selectable) text fall back to OCR when OCR_ENABLED."""
    from pypdf import PdfReader

    reader = PdfReader(path)
    pages: list[tuple[int, str]] = []
    empty_indices: list[int] = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not text.strip():
            empty_indices.append(len(pages))
        pages.append((i, text))

    # OCR only the pages that yielded no text, so normal (text-based) PDFs and
    # the text pages of mixed PDFs stay fast and are unaffected.
    if settings.OCR_ENABLED and empty_indices:
        for idx, ocr_text in _ocr_pdf_pages(path, empty_indices).items():
            pages[idx] = (pages[idx][0], ocr_text)
    return pages


def _extract_docx(path: str) -> list[tuple[int, str]]:
    import docx

    doc = docx.Document(path)
    text = "\n".join(p.text for p in doc.paragraphs)
    return [(1, text)]


def _extract_txt(path: str) -> list[tuple[int, str]]:
    with open(path, encoding="utf-8", errors="ignore") as f:
        return [(1, f.read())]


def extract_text(path: str, file_type: str) -> list[tuple[int, str]]:
    if file_type == "pdf":
        return _extract_pdf(path)
    if file_type == "docx":
        return _extract_docx(path)
    if file_type == "txt":
        return _extract_txt(path)
    raise ValueError(f"Unsupported file type: {file_type}")


def _clean(text: str) -> str:
    # Light preprocessing: collapse excess whitespace, keep content intact.
    return " ".join(text.split())


# ---------- Section / heading detection ----------
import re

_HEADING_NUM = re.compile(r"^(?:\d+(?:\.\d+)*\.?|[IVXLC]+\.?)\s+\S")


def _is_heading(line: str) -> bool:
    """Best-effort detection of a section heading line."""
    s = line.strip()
    if len(s) < 3 or len(s) > 70:
        return False
    if s[-1] in ".,;:":
        return False
    words = s.split()
    if len(words) > 10:
        return False
    letters = [c for c in s if c.isalpha()]
    if len(letters) < 3:
        return False
    # ALL-CAPS heading, e.g. "ASSESSMENT GUIDELINES FOR PROJECT EVALUATION"
    if all(c.isupper() for c in letters):
        return True
    # Numbered / roman-numeral heading, e.g. "1. Project Proposal" / "VII Assessment"
    if _HEADING_NUM.match(s) and len(words) <= 9:
        return True
    # Short Title Case heading, e.g. "Assessment Criteria"
    if len(words) <= 6 and sum(1 for w in words if w[:1].isupper()) >= max(1, len(words) - 1):
        return True
    return False


def _split_sections(text: str) -> list[tuple[str | None, str]]:
    """Split a page's text into (section_title, body) segments by heading lines."""
    lines = text.split("\n")
    sections: list[tuple[str | None, str]] = []
    current_title: str | None = None
    buf: list[str] = []
    for line in lines:
        if _is_heading(line):
            if buf:
                sections.append((current_title, "\n".join(buf)))
                buf = []
            current_title = line.strip()
        buf.append(line)
    if buf:
        sections.append((current_title, "\n".join(buf)))
    return sections or [(None, text)]


# ---------- Pipeline ----------
def process_document(db: Session, document: Document) -> None:
    """Run the full ingest pipeline for one document and persist status."""
    document.processing_status = "processing"
    db.commit()

    try:
        pages = extract_text(document.file_path, document.file_type)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        chunks: list[LCDocument] = []
        ids: list[str] = []
        for page_number, raw in pages:
            chunk_idx = 0
            for section_title, body in _split_sections(raw):
                cleaned = _clean(body)
                if not cleaned:
                    continue
                for piece in splitter.split_text(cleaned):
                    chunk_id = str(uuid.uuid4())
                    chunks.append(
                        LCDocument(
                            page_content=piece,
                            metadata={
                                "document_id": str(document.document_id),
                                "user_id": str(document.user_id),
                                "title": document.title,
                                "file_type": document.file_type,
                                "page_number": page_number,
                                # Chroma metadata cannot be None -> use "".
                                "section": section_title or "",
                                "chunk_index": chunk_idx,
                            },
                        )
                    )
                    ids.append(chunk_id)
                    chunk_idx += 1

        if not chunks:
            if document.file_type == "pdf":
                if settings.OCR_ENABLED:
                    raise ValueError(
                        "No text could be read from this PDF. It has no selectable "
                        "text and OCR couldn't recognize any text in the page images "
                        "— the scan may be blank, very low quality, or rotated. Try a "
                        "clearer scan or a text-based PDF."
                    )
                raise ValueError(
                    "No selectable text found — this looks like a scanned or "
                    "image-only PDF. OCR is disabled, so please upload a "
                    "text-based PDF (one where you can select/copy the text)."
                )
            raise ValueError("No extractable text found in the document.")

        vector_store.add_chunks(chunks, ids)

        document.chunk_count = len(chunks)
        document.processing_status = "done"
        document.error_message = None
        db.commit()

    except Exception as exc:  # noqa: BLE001 - record failure for the user/admin
        document.processing_status = "failed"
        document.error_message = str(exc)[:500]
        db.commit()
        raise
