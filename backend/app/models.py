"""
SQLAlchemy ORM models.

These map one-to-one to the relational schema described in the approved
synopsis (Database Design section): users, documents, conversations,
messages, and query_logs.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = _uuid_pk()
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Standing instructions the user sets once in Settings. They ride above the
    # grounding rules on every answer, the same way a project's do, and like a
    # project's they cannot switch citation or the answer-only-from-context
    # rules off.
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # One of rag_engine.WORK_ROLES, or NULL. Stored as the id and not as a
    # label, so it survives the interface being read in another language.
    work_role: Mapped[str | None] = mapped_column(String(40), nullable=True)

    documents: Mapped[list["Document"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="owner", cascade="all, delete-orphan")

    __table_args__ = (CheckConstraint("role IN ('user','admin')", name="ck_users_role"),)


class Document(Base):
    __tablename__ = "documents"

    document_id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    upload_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processing_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Live ingest progress for the pipeline UI. `processing_status` stays the
    # coarse, queryable/filterable state; these three carry the fine detail the
    # processor writes as it works. `progress` is overall percent (0-100) and is
    # only ever moved forward, so the client can safely smooth between polls.
    stage: Mapped[str | None] = mapped_column(String(20), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    stage_detail: Mapped[str | None] = mapped_column(String(120), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="documents")

    __table_args__ = (
        CheckConstraint("file_type IN ('pdf','docx','txt','md')", name="ck_documents_file_type"),
        CheckConstraint("file_size > 0", name="ck_documents_file_size"),
        CheckConstraint(
            "processing_status IN ('pending','processing','ocr','done','failed')",
            name="ck_documents_status",
        ),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    # A conversation may belong to a project, which supplies its instructions
    # and restricts retrieval to that project's documents. NULL = a loose chat
    # that searches the whole library, which is how every chat worked before
    # projects existed.
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    # Pinned chats sort above the rest. Unread is set by hand from the chat's
    # menu and cleared when the chat is opened; nothing marks it automatically.
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    unread: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True
    )

    owner: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    message_id: Mapped[uuid.UUID] = _uuid_pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.conversation_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_documents: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    __table_args__ = (CheckConstraint("role IN ('user','assistant')", name="ck_messages_role"),)


class QueryLog(Base):
    __tablename__ = "query_logs"

    log_id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.conversation_id", ondelete="SET NULL"),
        nullable=True,
    )
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    chunks_retrieved: Mapped[int] = mapped_column(Integer, default=0)
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="success")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PasswordResetToken(Base):
    """Short-lived code that lets a user reset a forgotten password.

    No email service is configured for this project, so the generated code is
    shown to the user on screen (it stands in for an emailed reset link). Only a
    hash of the code is stored, and each code is single-use and time-limited.
    """

    __tablename__ = "password_reset_tokens"

    token_id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    """A workspace that pins its own instructions and its own set of documents.

    The point is isolation: a chat inside a project retrieves only from the
    documents attached to that project, so answers cannot be assembled from
    unrelated files that happen to sit in the same library.
    """

    __tablename__ = "projects"

    project_id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Free-text standing instructions applied to every chat in the project.
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "all"      -> retrieve from the user's whole library
    # "selected" -> retrieve only from the linked documents below
    doc_scope: Mapped[str] = mapped_column(String(10), default="selected", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True
    )

    owner: Mapped["User"] = relationship()
    links: Mapped[list["ProjectDocument"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("doc_scope IN ('all','selected')", name="ck_projects_doc_scope"),
    )


class ProjectDocument(Base):
    """Link row putting one document in one project.

    A document can sit in several projects at once and still be the single copy
    in the user's library, so attaching it to a project never re-uploads or
    re-indexes anything.
    """

    __tablename__ = "project_documents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), primary_key=True
    )

    project: Mapped["Project"] = relationship(back_populates="links")
    document: Mapped["Document"] = relationship()
