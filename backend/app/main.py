"""
FastAPI application entrypoint for the RAG Powered Knowledge System.
"""

import os
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text, update

from app.api import admin, auth, chat, documents, projects, usage
from app.api import settings as settings_api
from app.config import settings
from app import runtime_settings
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
    # Apply any persisted runtime settings overrides on top of .env defaults.
    runtime_settings.apply_saved()
    # Create tables if they don't exist (dev convenience; use Alembic for prod).
    Base.metadata.create_all(bind=engine)

    # create_all only creates MISSING TABLES -- it never adds columns to a table
    # that already exists, and this project has no Alembic migrations wired up.
    # Add the live-progress columns idempotently so existing installs pick them
    # up without a manual migration or a database wipe.
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false")
        )
        conn.execute(
            text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread BOOLEAN NOT NULL DEFAULT false")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_instructions TEXT")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS work_role VARCHAR(40)")
        )
        # Widening a CHECK means replacing it: dropping first is what makes
        # this safe to run again.
        conn.execute(
            text("ALTER TABLE documents DROP CONSTRAINT IF EXISTS ck_documents_file_type")
        )
        conn.execute(
            text(
                "ALTER TABLE documents ADD CONSTRAINT ck_documents_file_type "
                "CHECK (file_type IN ('pdf','docx','txt','md'))"
            )
        )
        conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS stage VARCHAR(20)"))
        conn.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0")
        )
        conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS stage_detail VARCHAR(120)"))
        # Only pinned documents and projects appear in the sidebar; the rest are
        # reached from their own page.
        conn.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false")
        )
        conn.execute(
            text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false")
        )
        # projects / project_documents are new tables, so create_all makes them;
        # conversations already exists, so its new column needs adding by hand.
        conn.execute(
            text(
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID "
                "REFERENCES projects(project_id) ON DELETE SET NULL"
            )
        )

    # Recover documents left mid-processing by a previous run/restart so they
    # don't stay stuck on "processing"/"pending" forever.
    db = SessionLocal()
    try:
        db.execute(
            update(Document)
            .where(Document.processing_status.in_(("processing", "pending", "ocr")))
            .values(
                processing_status="failed",
                stage="failed",
                stage_detail=None,
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
app.include_router(projects.router)
app.include_router(admin.router)
app.include_router(settings_api.router)
app.include_router(usage.router)
