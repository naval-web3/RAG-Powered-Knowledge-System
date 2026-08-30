"""
RAG query engine (synopsis Module 4).

Flow: receive query -> semantic search (top-k, user-scoped) -> build an
augmented prompt (query + retrieved context) -> call the selected LLM ->
return the answer together with source citations.
"""

import re
import time
from collections.abc import Iterator

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.config import settings
from app.schemas import SourceCitation
from app.services import vector_store
from app.services.llm_providers import LLMProvider, get_provider

# How an answer should read. Shared, because the voice should not change with
# where the answer came from.
_STYLE = (
    "Write it the way a well-informed colleague would explain it out loud. "
    "Default to short paragraphs of plain prose, and let the writing carry the "
    "emphasis: do not bold words, and never open a line with a bolded label "
    "followed by a colon. Reach for a list only when the content genuinely is "
    "one. If it is a sequence of steps or a procedure, number them ('1.', "
    "'2.', ...); if it is several separate points with no order between them, "
    "use '- ' bullets. Two or three things belong in a sentence, not a list. "
    "Do not use em dashes; use a comma, a colon, or a full stop."
)

SYSTEM_PROMPT = (
    "You are a knowledge assistant. Answer the user's question using ONLY the "
    "excerpts provided below, which come from the user's documents. Give a "
    "complete answer that covers all relevant details found in the excerpts: "
    "do not omit information the user asked for.\n"
    f"{_STYLE}\n"
    "Do NOT mention the source, document name, or page number in your answer, "
    "because the source is shown to the user separately. If the answer is not "
    "in the excerpts, say you don't have enough information in the provided "
    "documents."
)

# For a question aimed at the conversation. The excerpt rules are left out
# altogether rather than softened, and no Context block is sent at all: a small
# model given "answer using ONLY the excerpts" and then "(no matching passages)"
# first decided it had nothing to say, and then applied the not-found line to
# the exchange it had itself answered a moment earlier.
CONVERSATION_PROMPT = (
    "You are a knowledge assistant. The user is asking about the conversation "
    "you have been having: what was said, what an earlier answer meant, or how "
    "to put it in another language. The conversation is written out below the "
    "heading 'Conversation so far'.\n"
    "Answer from that transcript. It is right there in this message, so never "
    "say the conversation has just started, that nothing has been discussed, or "
    "that you cannot see it. This question is not about the user's documents, "
    "so do not say anything about what is or is not in them.\n"
    f"{_STYLE}"
)

# Added only when there are earlier turns to refer to. A question about the
# conversation is not a question about the documents, and answering it from the
# transcript is not a hole in the grounding: the text is already on the user's
# screen. Questions about the documents still have to come from the excerpts.
HISTORY_RULE = (
    "\nThe conversation so far is above. Some questions are about the conversation "
    "itself rather than about the documents: what was said, what an earlier answer "
    "meant, or how to put it in another language. Answer those from the conversation. "
    "A question about the documents is still answered only from the excerpts, and if "
    "they do not cover it, say so."
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


# The languages the interface offers, mapped to what to call them in a prompt.
# A locale that is not in here is ignored rather than passed through, which is
# what keeps a client from writing its own instruction into the system message.
LANGUAGE_NAMES = {
    "en-US": "English",
    "fr-FR": "French",
    "de-DE": "German",
    "hi-IN": "Hindi",
    "id-ID": "Indonesian",
    "it-IT": "Italian",
    "ja-JP": "Japanese",
    "ko-KR": "Korean",
    "pt-BR": "Brazilian Portuguese",
    "es-419": "Latin American Spanish",
    "es-ES": "European Spanish",
}
# English is the prompt's own language, so asking for it adds nothing.
_IMPLIED_LANGUAGE = "en-US"


# What a reader does for a living, as the prompt should refer to them. Keys are
# what the client sends and what the database stores; a value not in here is
# ignored rather than passed through, for the same reason the locales are:
# nothing a client can type reaches a system message.
WORK_ROLES = {
    "student": "a student",
    "research": "a researcher",
    "teaching": "a teacher",
    "engineering": "engineering",
    "product": "product management",
    "design": "design",
    "data_science": "data science",
    "marketing": "marketing",
    "sales": "sales",
    "operations": "operations",
    "finance": "finance",
    "hr": "human resources",
    "legal": "law",
    "support": "customer support",
    "healthcare": "healthcare",
    "other": "",  # chosen deliberately, and says nothing worth putting in a prompt
}


def work_line(role: str | None) -> str | None:
    """The sentence that pitches an answer at this reader, or None to say nothing."""
    who = WORK_ROLES.get(role or "")
    if not who:
        return None
    article = "is" if who.startswith("a ") else "is in"
    return (
        f"The person asking {article} {who}. Pitch the level of detail and the "
        "vocabulary for that reader: assume what they would already know, and "
        "explain what they would not. This changes how you explain something, "
        "never what you are allowed to answer from."
    )


def language_line(locale: str | None) -> str | None:
    """The sentence that asks for a reply in `locale`, or None to say nothing."""
    if not locale or locale == _IMPLIED_LANGUAGE:
        return None
    name = LANGUAGE_NAMES.get(locale)
    if not name:
        return None
    # "Unless the instructions above say otherwise" so an explicit standing
    # instruction about language still wins over a menu setting.
    return (
        f"Unless the instructions above say otherwise, write your answer in {name}. "
        "The excerpts may be in another language; translate what you need from them "
        "rather than quoting them untranslated."
    )


# Questions aimed at the conversation rather than at the documents: what was
# said, what an answer meant, how to put it in another language.
#
# A list of phrases is a blunt instrument, but the alternatives are worse: the
# relevance score cannot tell these apart from real questions, and classifying
# every turn with a second model call would double the wait on a 4GB card. It
# only ever has to be right about the OPENING of the question, and a miss is
# not fatal -- the question still gets answered, just with excerpts alongside.
#
# Covers the eleven interface languages, because someone reading a Korean
# interface asks in Korean.
_ABOUT_CHAT_RE = re.compile(
    "|".join(
        [
            # English
            r"th(is|e) (chat|conversation|thread)", r"our conversation",
            r"you(r| have| '?ve)? (just )?(said|wrote|answered)",
            r"your (last |previous |above )?(answer|reply|response|message)",
            r"the above", r"translate (this|it|that)",
            # French
            r"cette conversation", r"ce chat", r"(ta|votre) r\u00e9ponse",
            r"ce que (tu as|vous avez) dit", r"tradui(s|re|sez)",
            # German
            r"diese[rs]? (chat|unterhaltung|gespr\u00e4ch)",
            r"(deine|ihre) antwort", r"was du gesagt", r"\u00fcbersetze",
            # Hindi
            r"(यह|इस) (चैट|बातचीत)", r"आपका (उत्तर|जवाब)", r"आपने क्या कहा", r"अनुवाद",
            # Indonesian
            r"(obrolan|percakapan) ini", r"jawaban (kamu|anda)", r"terjemahkan",
            # Italian
            r"questa (chat|conversazione)", r"la tua risposta", r"traduci",
            # Japanese
            r"この(会話|チャット|やり取り)", r"(あなたの|さっきの)(回答|返事)", r"翻訳",
            # Korean
            r"이 (대화|채팅)", r"(당신의|네) 답변", r"번역",
            # Portuguese
            r"est[ae] (conversa|chat)", r"sua resposta", r"traduz(a|ir)",
            # Spanish
            r"est[ae] (conversaci\u00f3n|chat)", r"(tu|su) respuesta", r"traduc(e|ir)",
        ]
    ),
    re.IGNORECASE,
)


def is_about_conversation(query: str) -> bool:
    """Is this asking about the conversation rather than about the documents?"""
    return bool(_ABOUT_CHAT_RE.search(query))


def _transcript(past: list) -> str:
    """The conversation as labelled text, for a model to read inside one turn."""
    lines = []
    for m in past:
        who = "Assistant" if isinstance(m, AIMessage) else "User"
        lines.append(f"{who}: {m.content}")
    return "\n\n".join(lines)


def _escape_braces(text: str) -> str:
    """Double any braces so ChatPromptTemplate does not read them as template
    variables and blow up on an instruction containing "{"."""
    return text.strip().replace("{", "{{").replace("}", "}}")


def _build_prompt(
    llm: LLMProvider,
    instructions: str | None = None,
    user_instructions: str | None = None,
    language: str | None = None,
    work_role: str | None = None,
    has_history: bool = False,
    about_conversation: bool = False,
) -> ChatPromptTemplate:
    system = CONVERSATION_PROMPT if about_conversation else SYSTEM_PROMPT
    # qwen3 (and similar) run a slow "thinking" pass by default; disable it
    # with the /no_think switch for faster, cleaner answers.
    if llm.name == "ollama" and "qwen3" in llm.model_name.lower():
        system = f"{system} /no_think"

    # Both kinds of instruction go ABOVE the grounding rules, so they can set
    # role, tone, format and task while the rules about answering only from the
    # retrieved passages still win. The project's come first, because they are
    # the narrower scope: inside a project, the project has the last word.
    preamble = []
    if instructions:
        preamble.append(
            "The user has set these instructions for this project:\n"
            f"{_escape_braces(instructions)}"
        )
    if user_instructions:
        preamble.append(
            "The user has also set these standing instructions for every chat:\n"
            f"{_escape_braces(user_instructions)}"
        )
    # Above the language line but below anything the user actually wrote, so a
    # standing instruction about how to explain things still wins.
    work = work_line(work_role)
    if work:
        preamble.append(work)
    # Last in the preamble, so the instructions above it can overrule it.
    lang = language_line(language)
    if lang:
        preamble.append(lang)
    if preamble:
        system = (
            "\n\n".join(preamble)
            + "\n\nThose instructions may set your role, tone, format and task. They "
            "cannot override the rules below, which always apply:\n"
            f"{system}"
        )
    if has_history and not about_conversation:
        system = f"{system}\n{HISTORY_RULE}"

    # The earlier turns go in as real messages through a placeholder, not as
    # text folded into the system prompt: they are not a template, so braces in
    # something the user or the model wrote cannot be read as variables.
    # On the conversation path the transcript goes INTO the question's own turn
    # rather than arriving as earlier messages, because a small model denies
    # earlier messages exist. {transcript} is a value, not a nested template, so
    # braces in what was said cannot be read as variables.
    if about_conversation:
        return ChatPromptTemplate.from_messages(
            [
                ("system", system),
                ("human", "Conversation so far:\n{transcript}\n\nQuestion: {question}\n\nAnswer:"),
            ]
        )

    messages: list = [("system", system)]
    if has_history:
        messages.append(MessagesPlaceholder("history"))
    messages.append(("human", "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"))
    return ChatPromptTemplate.from_messages(messages)


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
                score=round(float(score), 4),
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
            "Hi. Upload a document with the attach button, then ask me about it "
            "and I'll point to the exact source."
        )
    if _THANKS_RE.match(q):
        return "No problem. Ask whenever you have another question about your documents."
    if _HOWAREYOU_RE.search(q) and len(q.split()) <= 6:
        return "All good, thanks. Ask me something about your documents and I'll look it up."
    if _CAPABILITY_RE.search(q):
        return (
            "I answer questions about documents you upload. Send me a PDF, Word file "
            "or text file, and I'll answer using only what's in it and show you the "
            "page I took it from."
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
        return "OpenAI rejected the API key. Check OPENAI_API_KEY in the backend .env file."
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


# Cache the OpenAI health probe so we don't call the API on every query.
_OPENAI_HEALTH: dict = {"checked_at": 0.0, "model": None, "error": None}
_OPENAI_HEALTH_TTL = 60.0  # seconds


def _provider_unavailable_message(llm) -> str | None:
    """For the OpenAI provider, return a friendly error message if the provider
    can't actually be used (no API key, no billing credit, or a bad key), so the
    user is told about it up front instead of getting a misleading "not found".
    Returns None when the provider is usable. Result is cached briefly to avoid
    probing the API on every request. Ollama needs no probe here (its errors are
    surfaced by the real generation call)."""
    if llm.name != "openai":
        return None
    # No key configured -> definitive, no probe needed.
    if not settings.OPENAI_API_KEY:
        return _llm_error_message(llm, RuntimeError("openai_api_key is not set"))

    now = time.perf_counter()
    if (
        _OPENAI_HEALTH["model"] == llm.model_name
        and (now - _OPENAI_HEALTH["checked_at"]) < _OPENAI_HEALTH_TTL
    ):
        return _OPENAI_HEALTH["error"]

    error: str | None = None
    try:
        # Minimal probe: if the account has no credit / a bad key, this raises
        # (e.g. insufficient_quota) without producing a billable completion.
        llm.chat_model().invoke("ping")
    except Exception as exc:  # noqa: BLE001
        error = _llm_error_message(llm, exc)

    _OPENAI_HEALTH.update({"checked_at": now, "model": llm.model_name, "error": error})
    return error


def _result(answer: str, sources: list, llm, chunks: int, start: float, top_score: float = 0.0) -> dict:
    return {
        "answer": answer,
        "sources": sources,
        "provider": llm.name,
        "model": llm.model_name,
        "chunks_retrieved": chunks,
        "top_score": round(float(top_score), 4) if top_score else None,
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
    "message, and never add names, brands, or facts that are not present. Reply with "
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


def _answer(
    llm: LLMProvider,
    query: str,
    context: str | None,
    sources: list[SourceCitation],
    past: list,
    instructions: str | None,
    user_instructions: str | None,
    language: str | None,
    work_role: str | None,
    start: float,
    chunks: int,
    top_score: float,
    stream: bool,
) -> Iterator[tuple[str, object]]:
    """Put the question to the model and yield its reply.

    Shared by the two paths that reach a model: a grounded answer from retrieved
    passages, and a question about the conversation, which arrives with context
    None and no sources.
    """
    about_conversation = context is None
    try:
        chain = _build_prompt(
            llm, instructions, user_instructions, language, work_role,
            has_history=bool(past), about_conversation=about_conversation,
        ) | llm.chat_model()
        payload: dict = {"question": query}
        if about_conversation:
            payload["transcript"] = _transcript(past)
        else:
            payload["context"] = context
            if past:
                payload["history"] = past
        if stream:
            # Tokens go out as the model writes them, but the caller still
            # replaces the streamed text with the answer on the final "done"
            # event: _clean_answer works on the complete reply (it strips
            # qwen3's <think> block, among others) and cannot run mid-stream.
            parts: list[str] = []
            for chunk in chain.stream(payload):
                piece = getattr(chunk, "content", "") or ""
                if piece:
                    parts.append(piece)
                    yield ("token", piece)
            answer = _clean_answer("".join(parts))
        else:
            answer = _clean_answer(chain.invoke(payload).content)
    except Exception as exc:  # noqa: BLE001 - surface a friendly message instead of a 500
        yield ("done", _result(_llm_error_message(llm, exc), [], llm, chunks, start, top_score))
        return

    # Relevant chunks were found, so show the cited sources. But if the answer
    # says the specific fact isn't actually present, drop the (misleading) page
    # numbers while keeping the documents + sections.
    if sources and any(h in answer.lower() for h in _NOT_PRESENT_HINTS):
        sources = [s.model_copy(update={"page_number": None}) for s in sources]

    yield ("done", _result(answer, sources, llm, chunks, start, top_score))


def _run(
    query: str,
    user_id: str,
    provider: str | None = None,
    model: str | None = None,
    has_documents: bool = True,
    scope_document_id: str | None = None,
    document_ids: list[str] | None = None,
    instructions: str | None = None,
    user_instructions: str | None = None,
    language: str | None = None,
    history: list[tuple[str, str]] | None = None,
    work_role: str | None = None,
    stream: bool = False,
) -> Iterator[tuple[str, object]]:
    """Execute one turn: greeting/small-talk -> friendly reply; otherwise a
    grounded RAG answer with cited sources (or a friendly not-found).

    scope_document_id restricts retrieval to one document. document_ids carries
    a project's scope: None means the whole library, and an empty list means the
    project has nothing attached yet, which is answered with a prompt to add
    something rather than by quietly searching everything. instructions are the
    project's standing instructions."""
    start = time.perf_counter()
    llm = get_provider(provider, model)
    past = [
        (AIMessage if role == "assistant" else HumanMessage)(content=text)
        for role, text in (history or [])
        if text
    ]

    # 0) Provider health: if OpenAI is selected but unusable (no credit / no key
    #    / bad key), say so directly instead of masking it as "nothing found".
    unavailable = _provider_unavailable_message(llm)
    if unavailable is not None:
        yield ("done", _result(unavailable, [], llm, 0, start))
        return

    # 1) Greetings / small talk -> conversational reply, skip retrieval.
    #    (Only when not scoped to a document: a scoped chat is always about docs.)
    if not scope_document_id:
        chit = _smalltalk_reply(query)
        if chit is not None:
            yield ("done", _result(chit, [], llm, 0, start))
            return

    # 2) No documents uploaded at all -> tell the user to upload first.
    if not has_documents:
        msg = "No documents uploaded yet. Please upload a relevant document to get started."
        yield ("done", _result(msg, [], llm, 0, start))
        return

    # 2b) A project scoped to its own documents, with none attached yet. Never
    #     fall back to the wider library here: the whole point of a project is
    #     that it cannot answer from documents the user did not put in it.
    if document_ids is not None and not document_ids:
        msg = (
            "This project has no documents attached yet. Add one from the "
            "Context panel and ask again."
        )
        yield ("done", _result(msg, [], llm, 0, start))
        return

    # 2c) A question about the conversation, where there is one to answer from.
    #     Retrieval is skipped rather than merely ignored: excerpts that reached
    #     the prompt would be summarised as though they were the chat.
    if past and is_about_conversation(query):
        yield from _answer(
            llm, query, None, [], past,
            instructions, user_instructions, language, work_role, start, 0, 0.0, stream,
        )
        return

    # 3) Retrieve, narrowing by project scope and then by any single-document
    #    scope the user picked inside that project.
    ids = list(document_ids) if document_ids is not None else None
    if scope_document_id:
        if ids is not None and scope_document_id not in ids:
            msg = "That document is not part of this project."
            yield ("done", _result(msg, [], llm, 0, start))
            return
        ids = [scope_document_id]
    results = vector_store.similarity_search(query, user_id=user_id, document_ids=ids)
    top_score = results[0][1] if results else 0.0

    # 4) Documents exist, but nothing relevant was found. Skip the model: it is
    #    faster, and a model with nothing to work from is a model inventing an
    #    answer. Questions about the conversation never reach here, having been
    #    taken by 2c above.
    if not results or top_score < RELEVANCE_MIN:
        msg = (
            "I couldn't find anything about that in your documents. Try wording it "
            "differently, or upload a document that covers it."
        )
        yield ("done", _result(msg, [], llm, len(results), start, top_score))
        return

    # 5) Grounded answer from the retrieved context.
    context, sources = _format_context(results)
    yield from _answer(
        llm, query, context, sources, past,
        instructions, user_instructions, language, work_role,
        start, len(results), top_score, stream,
    )
    return


def answer_query(
    query: str,
    user_id: str,
    provider: str | None = None,
    model: str | None = None,
    has_documents: bool = True,
    scope_document_id: str | None = None,
    document_ids: list[str] | None = None,
    instructions: str | None = None,
    user_instructions: str | None = None,
    language: str | None = None,
    history: list[tuple[str, str]] | None = None,
    work_role: str | None = None,
) -> dict:
    """Run one turn and return the finished result."""
    for kind, payload in _run(
        query=query,
        user_id=user_id,
        provider=provider,
        model=model,
        has_documents=has_documents,
        scope_document_id=scope_document_id,
        document_ids=document_ids,
        instructions=instructions,
        user_instructions=user_instructions,
        language=language,
        history=history,
        work_role=work_role,
        stream=False,
    ):
        if kind == "done":
            return payload  # type: ignore[return-value]
    raise RuntimeError("the RAG engine produced no result")


def answer_query_stream(
    query: str,
    user_id: str,
    provider: str | None = None,
    model: str | None = None,
    has_documents: bool = True,
    scope_document_id: str | None = None,
    document_ids: list[str] | None = None,
    instructions: str | None = None,
    user_instructions: str | None = None,
    language: str | None = None,
    history: list[tuple[str, str]] | None = None,
    work_role: str | None = None,
) -> Iterator[tuple[str, object]]:
    """Run one turn, yielding ("token", text) as the model writes and finally
    ("done", result). Every early exit yields only the "done" event, so a
    greeting or a not-found reply still arrives in one piece."""
    return _run(
        query=query,
        user_id=user_id,
        provider=provider,
        model=model,
        has_documents=has_documents,
        scope_document_id=scope_document_id,
        document_ids=document_ids,
        instructions=instructions,
        user_instructions=user_instructions,
        language=language,
        history=history,
        work_role=work_role,
        stream=True,
    )
