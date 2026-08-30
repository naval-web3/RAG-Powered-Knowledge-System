"""Document management + processing routes (synopsis Modules 2 & 3)."""

import os
import subprocess
import sys
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi import Response
from fastapi.responses import FileResponse
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import get_current_user
from app.models import Document, Project, ProjectDocument, User
from app.schemas import DocumentChunk, DocumentContent, DocumentOut, DocumentPage
from app.services import vector_store
from app.services.document_processor import extract_text

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED = {"pdf", "docx", "txt", "md"}


def _run_pipeline(document_id: uuid.UUID) -> None:
    """Background worker: process one document in a SEPARATE process.

    The ingest pipeline does heavy native work (PyMuPDF page rendering, OCR via
    onnxruntime, local embeddings via torch). Running that in the server's
    thread pool can deadlock the worker thread and leave uploads stuck on
    "processing" forever. Running it as its own process (app.worker) is isolated
    and can be given a hard timeout, so a bad file fails cleanly instead of
    hanging. On timeout / crash we mark the document failed here.
    """
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "app.worker", str(document_id)],
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            capture_output=True,
            text=True,
            timeout=settings.DOC_PROCESS_TIMEOUT,
        )
        if proc.returncode == 0:
            return
        # Non-zero exit: the worker already persisted a specific 'failed' status
        # in most cases. Only backfill a generic failure if it's still unfinished.
        _mark_failed_if_unfinished(
            document_id,
            "Processing failed unexpectedly. Please try re-uploading.",
        )
    except subprocess.TimeoutExpired:
        _mark_failed_if_unfinished(
            document_id,
            "Processing took too long and was stopped. If this is a large scanned "
            "PDF, try a smaller file or a text-based PDF.",
        )
    except Exception:  # noqa: BLE001 - never let the background task blow up
        _mark_failed_if_unfinished(
            document_id, "Processing failed unexpectedly. Please try re-uploading."
        )


def _mark_failed_if_unfinished(document_id: uuid.UUID, message: str) -> None:
    """Flip a still-unfinished document to 'failed' with a user-facing message."""
    db = SessionLocal()
    try:
        db.execute(
            update(Document)
            .where(
                Document.document_id == document_id,
                Document.processing_status.in_(("pending", "processing", "ocr")),
            )
            .values(processing_status="failed", stage="failed", error_message=message)
        )
        db.commit()
    finally:
        db.close()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    # When the upload starts from inside a project, the new document is filed
    # into it as well as the library, so the user does not have to attach it
    # by hand afterwards.
    project_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
    project: Project | None = None
    if project_id:
        project = db.get(Project, project_id)
        if project is None or project.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type '.{ext}'. Allowed: pdf, docx, txt")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")

    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.user_id))
    os.makedirs(user_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4()}.{ext}"
    stored_path = os.path.join(user_dir, stored_name)
    with open(stored_path, "wb") as f:
        f.write(data)

    doc = Document(
        user_id=current_user.user_id,
        title=(file.filename or stored_name),
        original_filename=file.filename or stored_name,
        file_path=stored_path,
        file_type=ext,
        file_size=len(data),
        processing_status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    if project is not None:
        db.add(ProjectDocument(project_id=project.project_id, document_id=doc.document_id))
        # An upload into a project is an explicit choice to use that file there,
        # so a project still set to "all documents" is switched to its own
        # selection rather than silently ignoring the attachment.
        project.doc_scope = "selected"
        db.commit()

    background.add_task(_run_pipeline, doc.document_id)
    return DocumentOut.model_validate(doc)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentOut]:
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.user_id)
        .order_by(Document.upload_date.desc())
        .all()
    )
    return [DocumentOut.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None or doc.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return DocumentOut.model_validate(doc)


# A whole book pasted into a .txt would otherwise be sent to a browser in one
# response. The viewer says when it has stopped.
MAX_CONTENT_CHARS = 400_000


def _owned(db: Session, document_id: uuid.UUID, user: User) -> Document:
    doc = db.get(Document, document_id)
    if doc is None or doc.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return doc


@router.get("/{document_id}/content", response_model=DocumentContent)
def document_content(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentContent:
    """The document as text, page by page.

    Re-extracted from the stored file on request. This is the same extraction
    the pipeline indexed, so what the reader sees is what was searched, and a
    scanned PDF shows its OCR rather than a blank page.
    """
    doc = _owned(db, document_id, current_user)
    if not os.path.exists(doc.file_path):
        raise HTTPException(status.HTTP_410_GONE, "The stored file is missing")
    try:
        pages = extract_text(doc.file_path, doc.file_type)
    except Exception as exc:  # noqa: BLE001 - a bad file is the user's problem to see
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Could not read this file: {exc}"
        ) from exc

    out: list[DocumentPage] = []
    budget = MAX_CONTENT_CHARS
    truncated = False
    for number, text in pages:
        text = text or ""
        if len(text) > budget:
            text = text[:budget]
            truncated = True
        budget -= len(text)
        out.append(DocumentPage(page_number=number, text=text))
        if budget <= 0:
            truncated = truncated or len(out) < len(pages)
            break
    return DocumentContent(
        document_id=doc.document_id,
        title=doc.title,
        file_type=doc.file_type,
        pages=out,
        truncated=truncated,
    )


@router.get("/{document_id}/chunks", response_model=list[DocumentChunk])
def document_chunks(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentChunk]:
    """The passages this document was split into, in split order.

    What retrieval actually searches. Seeing them explains why a question
    matched one part of a document and not another.
    """
    doc = _owned(db, document_id, current_user)
    return [DocumentChunk(**row) for row in vector_store.chunks_for_document(str(doc.document_id))]


# Wide enough to stay sharp on a high-density screen at the size it is drawn,
# and small enough that rendering it is not worth caching.
THUMB_WIDTH = 420


@router.get("/{document_id}/thumbnail")
def document_thumbnail(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """The first page of a PDF, as a PNG.

    Rendered here rather than in the browser: PyMuPDF is already a dependency
    for reading PDFs, and the alternative is shipping a PDF engine to the client
    and downloading the whole file to draw one page of it.
    """
    doc = _owned(db, document_id, current_user)
    if doc.file_type != "pdf":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a PDF")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status.HTTP_410_GONE, "The stored file is missing")

    import fitz  # PyMuPDF, already used to read PDFs

    try:
        with fitz.open(doc.file_path) as pdf:
            if pdf.page_count == 0:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "This PDF has no pages")
            page = pdf.load_page(0)
            zoom = THUMB_WIDTH / max(page.rect.width, 1)
            png = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).tobytes("png")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - a card without a picture is fine
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Could not render this PDF: {exc}"
        ) from exc

    # Private: it is one user's document, and it should not be held by a shared
    # cache on the way. A day is plenty for a page that cannot change.
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/{document_id}/pages")
def document_pages(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """The page count, for the card a PDF opens to.

    Read from the chunks rather than from the file: the file would have to be
    parsed again, and for a scanned PDF that means running OCR to answer a
    question the index already knows.
    """
    doc = _owned(db, document_id, current_user)
    return {"page_count": vector_store.page_count_for_document(str(doc.document_id))}


@router.get("/{document_id}/file")
def document_file(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """The original upload, byte for byte, under the name it arrived with."""
    doc = _owned(db, document_id, current_user)
    if not os.path.exists(doc.file_path):
        raise HTTPException(status.HTTP_410_GONE, "The stored file is missing")
    return FileResponse(
        doc.file_path,
        filename=doc.original_filename,
        media_type="application/octet-stream",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    doc = db.get(Document, document_id)
    if doc is None or doc.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    # Remove vectors, then the stored file, then the DB record.
    vector_store.delete_document(str(doc.document_id))
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except OSError:
        pass
    db.delete(doc)
    db.commit()
