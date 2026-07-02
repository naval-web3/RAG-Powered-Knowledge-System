"""
RAG query engine (synopsis Module 4).

Flow: receive query -> semantic search (top-k, user-scoped) -> build an
augmented prompt (query + retrieved context) -> call the selected LLM ->
return the answer together with source citations.
"""

import re
import time

from langchain_core.prompts import ChatPromptTemplate

from app.config import settings
from app.schemas import SourceCitation
from app.services import vector_store
from app.services.llm_providers import LLMProvider, get_provider

SYSTEM_PROMPT = (
    "You are a knowledge assistant. Answer the user's question directly and "
    "concisely using ONLY the excerpts provided below, which come from the "
    "user's documents. Give just the answer in one or a few short sentences. "
    "Do NOT mention the source, document name, or page number in your answer - "
    "the source is shown separately to the user. If the answer is not in the "
    "excerpts, say you don't have enough information in the provided documents."
)

# Phrases that indicate the specific fact is NOT present in the document even
# though the topic is related. In that case we keep the source (document +
# section) but drop the page number, since no single page contains the answer.
_NOT_PRESENT_HINTS = (
    "not specified",
    "not mentioned",
    "not provided",
    "not stated",
    "not given",
    "not included",
    "not detailed",
    "not explicitly",
    "does not specify",
    "doesn't specify",
    "does not mention",
    "doesn't mention",
    "no information",
    "not found in",
    "isn't specified",
    "is not specified",
    "not available in",
    "enough information",
    "couldn't find",
    "could not find",
    "don't have",
)

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _build_prompt(llm: LLMProvider) -> ChatPromptTemplate:
    system = SYSTEM_PROMPT
    # qwen3 (and similar) run a slow "thinking" pass by default; disable it
    # with the /no_think switch for faster, cleaner answers.
    if llm.name == "ollama" and "qwen3" in llm.model_name.lower():
        system = f"{SYSTEM_PROMPT} /no_think"
    return ChatPromptTemplate.from_messages(
        [
            ("system", system),
            ("human", "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"),
        ]
    )


def _clean_answer(text: str) -> str:
    """Strip any leftover <think>...</think> reasoning blocks."""
    return _THINK_RE.sub("", text).strip()


def _format_context(results) -> tuple[str, list[SourceCitation]]:
    """Build the plain-text context and the per-chunk source list (ordered by
    relevance; results[0] is the best match)."""
    context_parts: list[str] = []
    sources: list[SourceCitation] = []
    for doc, score in results:
        meta = doc.metadata or {}
        context_parts.append(doc.page_content)
        sources.append(
            SourceCitation(
                document_id=str(meta.get("document_id", "")),
                title=str(meta.get("title", "document")),
                page_number=meta.get("page_number"),
                section=(meta.get("section") or None),
                chunk_index=meta.get("chunk_index"),
                snippet=doc.page_content[:200],
            )
        )
    return "\n\n---\n\n".join(context_parts), sources


# Below this top relevance score, retrieved chunks are treated as not relevant
# (calibrated: real questions score ~0.28+, off-topic ones score < 0.1).
RELEVANCE_MIN = 0.15

_GREETING_RE = re.compile(
    r"^(hi+|hey+|hello+|yo|hiya|heya|sup|howdy|good\s+(morning|afternoon|evening|day)|greetings)"
    r"(\s+there)?[\s!.,]*$",
    re.IGNORECASE,
)
_THANKS_RE = re.compile(r"^(thanks|thank you|thx|ty|cheers|appreciate it)[\s!.,]*$", re.IGNORECASE)
_HOWAREYOU_RE = re.compile(r"\b(how are you|how'?s it going|how do you do|what'?s up|wassup)\b", re.IGNORECASE)
_CAPABILITY_RE = re.compile(
    r"\b(who are you|what (can|do) you do|what are you|how does this work|"
    r"how (do|can) (i|you) (use|work)|what is this|can you help)\b",
    re.IGNORECASE,
)


def _smalltalk_reply(query: str) -> str | None:
    """Return a friendly conversational reply for greetings / small talk,
    or None if the message should go through the document RAG pipeline."""
    q = query.strip()
    if _GREETING_RE.match(q):
        return (
            "Hi! I'm your knowledge assistant. Upload a document with the attach "
            "button, then ask me anything about it and I'll answer with the exact source."
        )
    if _THANKS_RE.match(q):
        return "You're welcome! Feel free to ask anything else about your documents."
    if _HOWAREYOU_RE.search(q) and len(q.split()) <= 6:
        return "Doing well, thanks! Ask me a question about your uploaded documents and I'll find the answer."
    if _CAPABILITY_RE.search(q):
        return (
            "I'm a document knowledge assistant. Upload PDFs, Word documents, or text "
            "files, and I'll answer your questions using only the content of those "
            "documents — citing the exact source, page, and section for every answer."
        )
    return None


def _llm_error_message(llm, exc: Exception) -> str:
    """Turn a model/provider exception into a friendly user-facing message."""
    text = str(exc).lower()
    if "insufficient_quota" in text or "exceeded your current quota" in text:
        return (
            "The OpenAI request failed: your account has no remaining quota. Add billing "
            "credit at platform.openai.com, or switch to a Local model."
        )
    if "invalid_api_key" in text or "incorrect api key" in text or "401" in text:
        return "OpenAI authentication failed — please check your API key in the backend .env."
    if "openai_api_key" in text or "api key is not set" in text:
        return "OpenAI isn't configured. Add OPENAI_API_KEY to the backend .env, or use a Local model."
    # Timeout: the model took longer than LLM_TIMEOUT to respond. Most common
    # cause locally is a model too large for the GPU (it falls back to CPU and
    # crawls). Point the user at a smaller/faster model rather than hanging.
    if any(w in text for w in ("timeout", "timed out", "readtimeout", "read timed out")):
        if llm.name == "ollama":
            return (
                f"The model '{llm.model_name}' took too long to respond and timed out. "
                "It may be too large for your GPU. Try a smaller, faster model such as "
                "llama3.2:3b."
            )
        return "The model took too long to respond and timed out. Please try again or switch models."
    if llm.name == "ollama" and any(w in text for w in ("connection", "refused", "11434")):
        return "Couldn't reach the local Ollama server. Make sure Ollama is running."
    return f"The {llm.name} model request failed. Please try again or switch models."


def _result(answer: str, sources: list, llm, chunks: int, start: float) -> dict:
    return {
        "answer": answer,
        "sources": sources,
        "provider": llm.name,
        "model": llm.model_name,
        "chunks_retrieved": chunks,
        "response_time_ms": int((time.perf_counter() - start) * 1000),
    }


def _smalltalk_category(query: str) -> str | None:
    """Return a short label for greetings / small talk, else None."""
    q = query.strip()
    if _GREETING_RE.match(q):
        return "Greeting"
    if _THANKS_RE.match(q):
        return "Thanks"
    if _HOWAREYOU_RE.search(q) and len(q.split()) <= 6:
        return "Small talk"
    if _CAPABILITY_RE.search(q):
        return "About the assistant"
    return None


_TITLE_SYS = (
    "You write very short chat titles. Rewrite the user's first message into a "
    "concise 3-6 word topic label. Use ONLY words and ideas already in the "
    "message — never add names, brands, or facts that are not present. Reply with "
    "the title only: no quotes, no trailing punctuation, no preamble."
)


def generate_title(query: str, provider: str | None = None, model: str | None = None) -> str:
    """Build a contextual conversation title from the first message: a fixed
    label for small talk, otherwise a short LLM-generated topic title."""
    category = _smalltalk_category(query)
    if category:
        return category

    llm = get_provider(provider, model)
    system = _TITLE_SYS
    if llm.name == "ollama" and "qwen3" in llm.model_name.lower():
        system = f"{_TITLE_SYS} /no_think"
    try:
        chain = ChatPromptTemplate.from_messages([("system", system), ("human", "{q}")]) | llm.chat_model()
        raw = _clean_answer(chain.invoke({"q": query}).content)
        title = raw.splitlines()[0].strip().strip('"').strip("'").strip(".").strip()
        return title[:60] or query[:60]
    except Exception:
        return query[:60]


def answer_query(
    query: str,
    user_id: str,
    provider: str | None = None,
    model: str | None = None,
    has_documents: bool = True,
) -> dict:
    """Execute one turn: greeting/small-talk -> friendly reply; otherwise a
    grounded RAG answer with a single source (or a friendly not-found)."""
    start = time.perf_counter()
    llm = get_provider(provider, model)

    # 1) Greetings / small talk -> conversational reply, skip retrieval.
    chit = _smalltalk_reply(query)
    if chit is not None:
        return _result(chit, [], llm, 0, start)

    # 2) No documents uploaded at all -> tell the user to upload first.
    if not has_documents:
        msg = "No documents uploaded yet. Please upload a relevant document to get started."
        return _result(msg, [], llm, 0, start)

    # 3) Retrieve from the user's documents.
    results = vector_store.similarity_search(query, user_id=user_id)
    top_score = results[0][1] if results else 0.0

    # 4) Documents exist, but nothing relevant was found.
    if not results or top_score < RELEVANCE_MIN:
        msg = (
            "I couldn't find anything about that in your uploaded documents. "
            "Try rephrasing your question or uploading a document that covers it."
        )
        return _result(msg, [], llm, len(results), start)

    # 4) Grounded answer from the retrieved context.
    context, sources = _format_context(results)
    try:
        chain = _build_prompt(llm) | llm.chat_model()
        answer = _clean_answer(chain.invoke({"context": context, "question": query}).content)
    except Exception as exc:  # noqa: BLE001 - surface a friendly message instead of a 500
        return _result(_llm_error_message(llm, exc), [], llm, len(results), start)

    # The question is on-topic (relevant chunks were found), so always show the
    # source. But if the answer says the specific fact isn't actually present,
    # drop the (misleading) page number while keeping the document + section.
    source = sources[0]
    if any(h in answer.lower() for h in _NOT_PRESENT_HINTS):
        source = source.model_copy(update={"page_number": None})
    display_sources = [source]

    return _result(answer, display_sources, llm, len(results), start)
