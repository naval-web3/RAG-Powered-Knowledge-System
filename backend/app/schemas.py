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
    # Restrict retrieval to a single document (retrieval scope). None = all docs.
    scope_document_id: uuid.UUID | None = None


class SourceCitation(BaseModel):
    document_id: str
    title: str
    page_number: int | None = None
    section: str | None = None
    chunk_index: int | None = None
    snippet: str | None = None
    score: float | None = None  # retrieval relevance (1 - cosine distance)


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID | None = None
    answer: str
    sources: list[SourceCitation] = []
    provider: str
    model: str
    response_time_ms: int
    chunks_retrieved: int = 0  # how many chunks the retriever returned
    top_score: float | None = None  # relevance of the best-matching chunk


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


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


# ---------- Admin ----------
class DayCount(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    total_queries: int
    avg_response_time_ms: float
    queries_by_provider: dict[str, int]
    queries_by_day: list[DayCount] = []  # last 14 days, oldest first
    documents_by_type: dict[str, int] = {}


class AdminUserOut(UserOut):
    document_count: int = 0
    query_count: int = 0


class QueryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: uuid.UUID
    query_text: str
    username: str | None = None
    llm_provider: str
    model_name: str
    chunks_retrieved: int
    response_time_ms: int
    status: str
    created_at: datetime


class ServiceStatus(BaseModel):
    name: str
    ok: bool
    detail: str


class SystemStatus(BaseModel):
    services: list[ServiceStatus] = []


# ---------- Settings / profile ----------
class SettingsOut(BaseModel):
    DEFAULT_LLM_PROVIDER: str
    OLLAMA_MODEL: str
    OPENAI_CHAT_MODEL: str
    RETRIEVAL_TOP_K: int
    LLM_TEMPERATURE: float
    CHUNK_SIZE: int
    CHUNK_OVERLAP: int
    openai_enabled: bool = False
    ollama_base_url: str = ""


class SettingsUpdate(BaseModel):
    DEFAULT_LLM_PROVIDER: str | None = None
    OLLAMA_MODEL: str | None = None
    OPENAI_CHAT_MODEL: str | None = None
    RETRIEVAL_TOP_K: int | None = None
    LLM_TEMPERATURE: float | None = None
    CHUNK_SIZE: int | None = None
    CHUNK_OVERLAP: int | None = None


class ProfileUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=100)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    # No email service is configured, so the reset code is returned for on-screen
    # display (it stands in for an emailed reset link). In production this would
    # be emailed instead and never returned in the response body.
    code: str
    expires_at: datetime
    expires_in_minutes: int


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)
    new_password: str = Field(min_length=6, max_length=128)
