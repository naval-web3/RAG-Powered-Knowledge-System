"""
Embedding backends.

Provides a LangChain-compatible Embeddings object selected at runtime:
  - "local"  -> sentence-transformers (all-MiniLM-L6-v2, 384 dims, free/offline)
  - "openai" -> OpenAI embeddings (text-embedding-3-small, 1536 dims)

Both expose embed_documents() and embed_query() so they can be plugged
straight into the Chroma vector store.
"""

import os
from functools import lru_cache

from langchain_core.embeddings import Embeddings

from app.config import settings

# The embedding model is downloaded once and cached locally; skip the online
# update check on load so startup is fast and works offline.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


class LocalEmbeddings(Embeddings):
    """Sentence-transformers embeddings (loaded lazily on first use)."""

    def __init__(self, model_name: str):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        if self._model is None:
            # Imported lazily because sentence-transformers is heavy to load.
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [v.tolist() for v in vectors]

    def embed_query(self, text: str) -> list[float]:
        return self.model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0].tolist()


@lru_cache
def get_embeddings() -> Embeddings:
    """Return the configured embedding backend (cached singleton)."""
    if settings.EMBEDDING_BACKEND == "openai":
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("EMBEDDING_BACKEND=openai but OPENAI_API_KEY is not set.")
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            model=settings.OPENAI_EMBEDDING_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )
    return LocalEmbeddings(settings.LOCAL_EMBEDDING_MODEL)
