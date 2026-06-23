"""Document management + processing routes (synopsis Modules 2 & 3)."""

import os
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import get_current_user
from app.models import Document, User
from app.schemas import DocumentOut
from app.services import vector_store
from app.services.document_processor import process_document

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED = {"pdf", "docx", "txt"}


def _run_pipeline(document_id: uuid.UUID) -> None:
    """Background worker: own DB session, process one document."""
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is not None:
            process_document(db, doc)
    except Exception:  # noqa: BLE001 - status already persisted as 'failed'
        pass
    finally:
        db.close()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
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
