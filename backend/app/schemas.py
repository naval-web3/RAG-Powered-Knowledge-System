"""
Pydantic schemas for request validation and response serialization.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Auth ----------
class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    username: str
    # Plain str on output: we validate emails on input (register/login), but
    # should never fail to serialize an already-stored user record.
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Documents ----------
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    document_id: uuid.UUID
    title: str
    original_filename: str
    file_type: str
    file_size: int
    upload_date: datetime
    processing_status: str
    chunk_count: int
    error_message: str | None = None


# ---------- Chat / RAG ----------
class ChatRequest(BaseModel):
    query: str = Field(min_length=1)
    conversation_id: uuid.UUID | None = None
    provider: str | None = None  # "ollama" | "openai" (overrides default)
    model: str | None = None
    incognito: bool = False  # private chat: not saved to history


class SourceCitation(BaseModel):
    document_id: str
    title: str
    page_number: int | None = None
    section: str | None = None
    chunk_index: int | None = None
    snippet: str | None = None


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID | None = None
    answer: str
    sources: list[SourceCitation] = []
    provider: str
    model: str
    response_time_ms: int


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    message_id: uuid.UUID
    role: str
    content: str
    source_documents: dict | list | None = None
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    conversation_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


# ---------- Admin ----------
class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    total_queries: int
    avg_response_time_ms: float
    queries_by_provider: dict[str, int]
