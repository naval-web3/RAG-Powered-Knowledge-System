"""
FastAPI application entrypoint for the RAG Powered Knowledge System.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, chat, documents
from app.config import settings
from app.database import Base, engine

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


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "default_provider": settings.DEFAULT_LLM_PROVIDER}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(admin.router)
