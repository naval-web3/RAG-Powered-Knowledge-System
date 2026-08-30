"""Chat / RAG query + conversation management routes (Modules 4 & 5)."""

import json
import uuid
from collections.abc import Iterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import get_current_user
from app.models import Conversation, Document, Message, Project, QueryLog, User
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationOut,
    ConversationPatch,
    MessageOut,
)
from app.services.rag_engine import answer_query, answer_query_stream, generate_title

router = APIRouter(prefix="/api", tags=["chat"])


# How much of the conversation travels with the question. Four exchanges is
# enough to answer "what did you just say" or to translate the last reply,
# without spending a small model's whole context window on history.
HISTORY_TURNS = 8
HISTORY_CHARS = 1500


def _recent_history(db: Session, conversation_id: uuid.UUID) -> list[tuple[str, str]]:
    """The last few messages of a conversation, oldest first.

    Read BEFORE the incoming question is stored, so the question does not arrive
    twice. Long messages are trimmed from the front: the end of an answer is
    what a follow-up usually refers to.
    """
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(HISTORY_TURNS)
        .all()
    )
    out: list[tuple[str, str]] = []
    for m in reversed(rows):
        text = m.content or ""
        if len(text) > HISTORY_CHARS:
            text = "\u2026" + text[-HISTORY_CHARS:]
        out.append((m.role, text))
    return out


def _project_document_ids(project: Project) -> list[str] | None:
    """Which documents a project may retrieve from.

    None means the whole library. A list restricts retrieval to those documents,
    and an empty list means the project has nothing attached yet.
    """
    if project.doc_scope == "all":
        return None
    return [str(link.document_id) for link in project.links]


def _sse(event: str, data: dict) -> str:
    return "event: %s\ndata: %s\n\n" % (event, json.dumps(data, default=str))


@router.post("/chat/stream")
def chat_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """The same turn as /chat, delivered as server-sent events.

    Emits `token` events as the model writes, then one `done` event carrying the
    cleaned answer, sources and telemetry. Clients should replace the text they
    accumulated with the answer from `done`: the streamed tokens are raw, and
    the cleaning step only runs once the reply is complete.
    """
    if payload.provider and payload.provider.lower() not in ("ollama", "openai"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unknown provider '{payload.provider}'. Use 'ollama' or 'openai'."
        )

    has_documents = (
        db.query(Document.document_id).filter(Document.user_id == current_user.user_id).first() is not None
    )

    scope_id: str | None = None
    if payload.scope_document_id:
        doc = db.get(Document, payload.scope_document_id)
        if doc is None or doc.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Scoped document not found")
        scope_id = str(payload.scope_document_id)

    project: Project | None = None
    project_id = payload.project_id
    if payload.conversation_id:
        existing = db.get(Conversation, payload.conversation_id)
        if existing is not None and existing.user_id == current_user.user_id:
            project_id = existing.project_id
    if project_id:
        project = db.get(Project, project_id)
        if project is None or project.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    doc_ids = _project_document_ids(project) if project else None
    instructions = project.instructions if project else None

    # Resolve the conversation and store the user message up front, while the
    # request-scoped session is still open.
    conv_id: uuid.UUID | None = None
    # A private chat is not stored, so it has nothing to look back on.
    history: list[tuple[str, str]] = []
    if not payload.incognito:
        if payload.conversation_id:
            conv = db.get(Conversation, payload.conversation_id)
            if conv is None or conv.user_id != current_user.user_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
            history = _recent_history(db, conv.conversation_id)
        else:
            conv = Conversation(
                user_id=current_user.user_id,
                project_id=project.project_id if project else None,
                title=generate_title(payload.query, payload.provider, payload.model),
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)
        db.add(Message(conversation_id=conv.conversation_id, role="user", content=payload.query))
        db.commit()
        conv_id = conv.conversation_id

    # Plain values only from here: the ORM objects above belong to a session
    # that will be closed before the generator runs.
    user_id = str(current_user.user_id)
    user_pk = current_user.user_id
    query_text = payload.query
    incognito = payload.incognito

    def events() -> Iterator[str]:
        result: dict | None = None
        for kind, item in answer_query_stream(
            query=query_text,
            user_id=user_id,
            provider=payload.provider,
            model=payload.model,
            has_documents=has_documents,
            scope_document_id=scope_id,
            document_ids=doc_ids,
            instructions=instructions,
            user_instructions=current_user.custom_instructions,
            language=payload.language,
            history=history,
        ):
            if kind == "token":
                yield _sse("token", {"t": item})
            else:
                result = item  # type: ignore[assignment]

        if result is None:  # pragma: no cover - _run always ends with "done"
            yield _sse("error", {"message": "The model returned nothing."})
            return

        sources_payload = [s.model_dump() for s in result["sources"]]

        if not incognito and conv_id is not None:
            own = SessionLocal()
            try:
                own.add(
                    Message(
                        conversation_id=conv_id,
                        role="assistant",
                        content=result["answer"],
                        source_documents={"sources": sources_payload},
                    )
                )
                own.add(
                    QueryLog(
                        user_id=user_pk,
                        conversation_id=conv_id,
                        query_text=query_text,
                        response_time_ms=result["response_time_ms"],
                        chunks_retrieved=result["chunks_retrieved"],
                        llm_provider=result["provider"],
                        model_name=result["model"],
                        status="success",
                    )
                )
                own.commit()
            finally:
                own.close()

        yield _sse(
            "done",
            {
                "conversation_id": conv_id,
                "answer": result["answer"],
                "sources": sources_payload,
                "provider": result["provider"],
                "model": result["model"],
                "response_time_ms": result["response_time_ms"],
                "chunks_retrieved": result["chunks_retrieved"],
                "top_score": result["top_score"],
            },
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    if payload.provider and payload.provider.lower() not in ("ollama", "openai"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unknown provider '{payload.provider}'. Use 'ollama' or 'openai'."
        )

    has_documents = (
        db.query(Document.document_id).filter(Document.user_id == current_user.user_id).first() is not None
    )

    # Retrieval scope: optionally restrict to a single document the user owns.
    scope_id: str | None = None
    if payload.scope_document_id:
        doc = db.get(Document, payload.scope_document_id)
        if doc is None or doc.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Scoped document not found")
        scope_id = str(payload.scope_document_id)

    # Project scope. An existing conversation already belongs to a project, so
    # only a brand new chat takes the project from the request.
    project: Project | None = None
    project_id = payload.project_id
    if payload.conversation_id:
        existing = db.get(Conversation, payload.conversation_id)
        if existing is not None and existing.user_id == current_user.user_id:
            project_id = existing.project_id
    if project_id:
        project = db.get(Project, project_id)
        if project is None or project.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    doc_ids = _project_document_ids(project) if project else None
    instructions = project.instructions if project else None

    # Incognito / private chat: answer but persist nothing (no conversation,
    # no messages, no query log).
    if payload.incognito:
        result = answer_query(
            query=payload.query,
            user_id=str(current_user.user_id),
            provider=payload.provider,
            model=payload.model,
            has_documents=has_documents,
            scope_document_id=scope_id,
            document_ids=doc_ids,
            instructions=instructions,
            user_instructions=current_user.custom_instructions,
            language=payload.language,
        )
        return ChatResponse(
            conversation_id=None,
            answer=result["answer"],
            sources=result["sources"],
            provider=result["provider"],
            model=result["model"],
            response_time_ms=result["response_time_ms"],
            chunks_retrieved=result["chunks_retrieved"],
            top_score=result["top_score"],
        )

    # Resolve or create the conversation.
    history: list[tuple[str, str]] = []
    if payload.conversation_id:
        conv = db.get(Conversation, payload.conversation_id)
        if conv is None or conv.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        history = _recent_history(db, conv.conversation_id)
    else:
        conv = Conversation(
            user_id=current_user.user_id,
            project_id=project.project_id if project else None,
            title=generate_title(payload.query, payload.provider, payload.model),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Store the user message.
    db.add(Message(conversation_id=conv.conversation_id, role="user", content=payload.query))
    db.commit()

    # Run the RAG pipeline.
    result = answer_query(
        query=payload.query,
        user_id=str(current_user.user_id),
        provider=payload.provider,
        model=payload.model,
        has_documents=has_documents,
        scope_document_id=scope_id,
        document_ids=doc_ids,
        instructions=instructions,
        user_instructions=current_user.custom_instructions,
        language=payload.language,
        history=history,
    )

    sources_payload = [s.model_dump() for s in result["sources"]]

    # Store the assistant message + query log.
    db.add(
        Message(
            conversation_id=conv.conversation_id,
            role="assistant",
            content=result["answer"],
            source_documents={"sources": sources_payload},
        )
    )
    db.add(
        QueryLog(
            user_id=current_user.user_id,
            conversation_id=conv.conversation_id,
            query_text=payload.query,
            response_time_ms=result["response_time_ms"],
            chunks_retrieved=result["chunks_retrieved"],
            llm_provider=result["provider"],
            model_name=result["model"],
            status="success",
        )
    )
    db.commit()

    return ChatResponse(
        conversation_id=conv.conversation_id,
        answer=result["answer"],
        sources=result["sources"],
        provider=result["provider"],
        model=result["model"],
        response_time_ms=result["response_time_ms"],
        chunks_retrieved=result["chunks_retrieved"],
        top_score=result["top_score"],
    )


@router.get("/models")
def list_models(current_user: User = Depends(get_current_user)) -> dict:
    """List the locally installed Ollama models and the configured OpenAI model
    so the user can pick which model to run a query against."""
    ollama_models: list[str] = []
    try:
        resp = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        resp.raise_for_status()
        ollama_models = [m["name"] for m in resp.json().get("models", [])]
        ollama_models.sort()
    except Exception:
        ollama_models = []

    # Always offer OpenAI as a choice. If no API key is configured, selecting it
    # returns a clear "add your API key" error at query time.
    openai_models = [settings.OPENAI_CHAT_MODEL]

    return {
        "default_provider": settings.DEFAULT_LLM_PROVIDER,
        "default_ollama_model": settings.OLLAMA_MODEL,
        "ollama": ollama_models,
        "openai": openai_models,
        "openai_enabled": bool(settings.OPENAI_API_KEY),
    }


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConversationOut]:
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [ConversationOut.model_validate(c) for c in convs]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationDetail:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    detail = ConversationDetail.model_validate(conv)
    detail.messages = [MessageOut.model_validate(m) for m in conv.messages]
    return detail


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    """Rename, pin, flag, or file a conversation. Only the fields sent are touched."""
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    fields: dict[str, object] = {}
    if payload.title is not None:
        fields["title"] = payload.title.strip()[:255]
    if payload.pinned is not None:
        fields["pinned"] = payload.pinned
    if payload.unread is not None:
        fields["unread"] = payload.unread
    # Sent-and-null means "take it out of its project", which is why this asks
    # what was in the request body rather than testing the value for None.
    if "project_id" in payload.model_fields_set:
        if payload.project_id is not None:
            project = db.get(Project, payload.project_id)
            if project is None or project.user_id != current_user.user_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
        fields["project_id"] = payload.project_id

    if fields:
        # Restating updated_at keeps the column's onupdate from firing: pinning,
        # flagging or renaming is not activity inside the conversation, and
        # bumping the timestamp would jump the row to the top of the list. A
        # Core UPDATE, because the ORM drops a no-op assignment and lets the
        # default through anyway.
        db.execute(
            update(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .values(updated_at=conv.updated_at, **fields)
        )
        db.commit()
        db.refresh(conv)
    return ConversationOut.model_validate(conv)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    db.delete(conv)
    db.commit()
