"""Project routes: standing instructions plus a pinned set of documents.

A project exists to keep one body of work separate from the rest of the
library. Chats started inside it retrieve only from the documents attached to
it, so an answer about (say) an HR policy can never be assembled from an
unrelated invoice that happens to live in the same account.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Conversation, Document, Project, ProjectDocument, User
from app.schemas import (
    ProjectCreate,
    ProjectDocumentsUpdate,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _owned(db: Session, project_id: uuid.UUID, user: User) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _out(db: Session, project: Project) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.document_ids = [link.document_id for link in project.links]
    out.conversation_count = (
        db.query(Conversation.conversation_id)
        .filter(Conversation.project_id == project.project_id)
        .count()
    )
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectOut]:
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.user_id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return [_out(db, p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectOut:
    project = Project(
        user_id=current_user.user_id,
        name=payload.name.strip()[:120],
        instructions=(payload.instructions or "").strip() or None,
        # A new project starts empty and scoped to its own documents, so it
        # cannot answer from the wider library until the user puts something
        # in it deliberately.
        doc_scope="selected",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _out(db, project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectOut:
    return _out(db, _owned(db, project_id, current_user))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectOut:
    project = _owned(db, project_id, current_user)
    fields: dict[str, object] = {}
    if payload.name is not None:
        fields["name"] = payload.name.strip()[:120]
    if payload.instructions is not None:
        fields["instructions"] = payload.instructions.strip() or None
    if payload.pinned is not None:
        fields["pinned"] = payload.pinned

    if fields:
        # Restating updated_at keeps the column's onupdate from firing. Renaming
        # a project or pinning it is not work done inside the project, and the
        # list is ordered by updated_at, so letting it bump would jump the row
        # to the top. A Core UPDATE, because the ORM drops a no-op assignment
        # and lets the default through anyway.
        db.execute(
            update(Project)
            .where(Project.project_id == project_id)
            .values(updated_at=project.updated_at, **fields)
        )
        db.commit()
        db.refresh(project)
    return _out(db, project)


@router.put("/{project_id}/documents", response_model=ProjectOut)
def set_project_documents(
    project_id: uuid.UUID,
    payload: ProjectDocumentsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectOut:
    """Replace the project's document selection in one call."""
    project = _owned(db, project_id, current_user)

    wanted = list(dict.fromkeys(payload.document_ids))  # de-duplicate, keep order
    if wanted:
        owned = {
            d.document_id
            for d in db.query(Document.document_id)
            .filter(
                Document.user_id == current_user.user_id,
                Document.document_id.in_(wanted),
            )
            .all()
        }
        missing = [str(d) for d in wanted if d not in owned]
        if missing:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                f"{len(missing)} of those documents could not be found in your library",
            )

    project.doc_scope = payload.doc_scope
    # Replace rather than merge: the client always sends the full selection, so
    # unticking a document in the picker actually detaches it.
    project.links.clear()
    db.flush()
    if payload.doc_scope == "selected":
        for doc_id in wanted:
            project.links.append(ProjectDocument(project_id=project.project_id, document_id=doc_id))
    db.commit()
    db.refresh(project)
    return _out(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a project. Its chats and documents survive.

    The chats are unpinned back into the general list and the documents stay in
    the library, because deleting a workspace should not destroy the work or the
    sources that were filed under it.
    """
    project = _owned(db, project_id, current_user)
    db.query(Conversation).filter(Conversation.project_id == project.project_id).update(
        {Conversation.project_id: None}, synchronize_session=False
    )
    db.delete(project)
    db.commit()
