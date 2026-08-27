"""
Vector store wrapper around ChromaDB (persistent / embedded mode).

Talks to Chroma through its native PersistentClient. We compute embeddings
ourselves (see services.embeddings) and pass them explicitly, so Chroma is
used purely as an indexed vector store with cosine similarity.
"""

from functools import lru_cache

import chromadb
from langchain_core.documents import Document as LCDocument

from app.config import settings
from app.services.embeddings import get_embeddings


@lru_cache
def get_collection():
    """Return the shared Chroma collection (cached singleton)."""
    client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
    return client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Compute embedding vectors for a batch of chunk texts."""
    return get_embeddings().embed_documents(texts)


def index_embedded(
    ids: list[str],
    texts: list[str],
    metadatas: list[dict],
    vectors: list[list[float]],
) -> None:
    """Write already-embedded chunks into the Chroma index."""
    get_collection().add(ids=ids, embeddings=vectors, documents=texts, metadatas=metadatas)


def add_chunks(chunks: list[LCDocument], ids: list[str]) -> None:
    """Embed and store a batch of document chunks in one step."""
    texts = [c.page_content for c in chunks]
    metadatas = [c.metadata for c in chunks]
    index_embedded(ids, texts, metadatas, embed_texts(texts))


def similarity_search(
    query: str,
    user_id: str,
    k: int | None = None,
    document_id: str | None = None,
) -> list[tuple[LCDocument, float]]:
    """
    Return up to k (document, relevance_score) pairs for a query, restricted
    to the requesting user's own documents via metadata filtering. When
    document_id is given, retrieval is further scoped to that one document.
    Relevance score = 1 - cosine_distance (higher is better).
    """
    k = k or settings.RETRIEVAL_TOP_K
    embeddings = get_embeddings()
    query_vec = embeddings.embed_query(query)

    # Chroma requires $and to combine multiple metadata conditions.
    if document_id:
        where = {"$and": [{"user_id": user_id}, {"document_id": document_id}]}
    else:
        where = {"user_id": user_id}

    res = get_collection().query(
        query_embeddings=[query_vec],
        n_results=k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    out: list[tuple[LCDocument, float]] = []
    for text, meta, dist in zip(docs, metas, dists):
        score = 1.0 - float(dist)
        out.append((LCDocument(page_content=text, metadata=meta or {}), score))
    return out


def delete_document(document_id: str) -> None:
    """Remove all chunks belonging to a document from the vector store."""
    get_collection().delete(where={"document_id": document_id})


def delete_user(user_id: str) -> None:
    """Remove all chunks belonging to a user from the vector store."""
    get_collection().delete(where={"user_id": user_id})
