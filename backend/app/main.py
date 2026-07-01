"""
FastAPI application entrypoint for the RAG Powered Knowledge System.
"""

import os
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import update

from app.api import admin, auth, chat, documents
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Document

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Retrieval-Augmented Generation knowledge base with multi-LLM support.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Ensure runtime directories exist.
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    # Create tables if they don't exist (dev convenience; use Alembic for prod).
    Base.metadata.create_all(bind=engine)

    # Recover documents left mid-processing by a previous run/restart so they
    # don't stay stuck on "processing"/"pending" forever.
    db = SessionLocal()
    try:
        db.execute(
            update(Document)
            .where(Document.processing_status.in_(("processing", "pending")))
            .values(
                processing_status="failed",
                error_message="Processing was interrupted (server restarted). Please re-upload.",
            )
        )
        db.commit()
    finally:
        db.close()

    # Pre-warm the embedding model in the background so the first upload isn't slow.
    def _warm() -> None:
        try:
            from app.services.embeddings import get_embeddings

            get_embeddings().embed_query("warmup")
        except Exception:  # noqa: BLE001 - warm-up is best effort
            pass

    threading.Thread(target=_warm, daemon=True).start()


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "default_provider": settings.DEFAULT_LLM_PROVIDER}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(admin.router)
