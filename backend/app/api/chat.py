"""Chat / RAG query + conversation management routes (Modules 4 & 5)."""

import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Conversation, Document, Message, QueryLog, User
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationOut,
    ConversationRename,
    MessageOut,
)
from app.services.rag_engine import answer_query, generate_title

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    has_documents = (
        db.query(Document.document_id).filter(Document.user_id == current_user.user_id).first() is not None
    )

    # Incognito / private chat: answer but persist nothing (no conversation,
    # no messages, no query log).
    if payload.incognito:
        result = answer_query(
            query=payload.query,
            user_id=str(current_user.user_id),
            provider=payload.provider,
            model=payload.model,
            has_documents=has_documents,
        )
        return ChatResponse(
            conversation_id=None,
            answer=result["answer"],
            sources=result["sources"],
            provider=result["provider"],
            model=result["model"],
            response_time_ms=result["response_time_ms"],
        )

    # Resolve or create the conversation.
    if payload.conversation_id:
        conv = db.get(Conversation, payload.conversation_id)
        if conv is None or conv.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    else:
        conv = Conversation(
            user_id=current_user.user_id,
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
def rename_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    conv.title = payload.title.strip()[:255]
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
