# Coding

## The Database Schema in SQL

The schema is defined once, as SQLAlchemy models, and the database is created from those definitions. The SQL below is not a hand-written transcription of what the models mean; it is what SQLAlchemy emits for the PostgreSQL dialect, and therefore exactly what the running system creates. The full script is on the submitted media as `report/assets/schema.sql`.

The `users` table carries the identity, the role and the two standing preferences that reach the prompt.

```sql
CREATE TABLE users (
    user_id UUID NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    custom_instructions TEXT,
    work_role VARCHAR(40),
    PRIMARY KEY (user_id),
    CONSTRAINT ck_users_role CHECK (role IN ('user','admin')),
    UNIQUE (username)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
```

The `documents` table is where most of the declared integrity sits, because it is the table a client can most easily be wrong about.

```sql
CREATE TABLE documents (
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    processing_status VARCHAR(20) NOT NULL,
    chunk_count INTEGER NOT NULL,
    error_message TEXT,
    stage VARCHAR(20),
    progress INTEGER DEFAULT '0' NOT NULL,
    stage_detail VARCHAR(120),
    pinned BOOLEAN DEFAULT 'false' NOT NULL,
    PRIMARY KEY (document_id),
    CONSTRAINT ck_documents_file_type
        CHECK (file_type IN ('pdf','docx','txt','md')),
    CONSTRAINT ck_documents_file_size CHECK (file_size > 0),
    CONSTRAINT ck_documents_status
        CHECK (processing_status IN ('pending','processing','ocr','done','failed')),
    FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_documents_processing_status ON documents (processing_status);
CREATE INDEX ix_documents_user_id ON documents (user_id);
```

The two tables that show the delete rules differing by intent are `conversations` and `query_logs`. A conversation cascades from its user but only loses its project; a log row loses both of its parents and survives.

```sql
CREATE TABLE conversations (
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    project_id UUID,
    title VARCHAR(255) NOT NULL,
    pinned BOOLEAN DEFAULT 'false' NOT NULL,
    unread BOOLEAN DEFAULT 'false' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (conversation_id),
    FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE SET NULL
);

CREATE TABLE query_logs (
    log_id UUID NOT NULL,
    user_id UUID,
    conversation_id UUID,
    query_text TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    chunks_retrieved INTEGER NOT NULL,
    llm_provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (log_id),
    FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    FOREIGN KEY(conversation_id)
        REFERENCES conversations (conversation_id) ON DELETE SET NULL
);
CREATE INDEX ix_query_logs_created_at ON query_logs (created_at);
```

The many-to-many link table is two columns and nothing else, because that is all it needs to be.

```sql
CREATE TABLE project_documents (
    project_id UUID NOT NULL,
    document_id UUID NOT NULL,
    PRIMARY KEY (project_id, document_id),
    FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
    FOREIGN KEY(document_id) REFERENCES documents (document_id) ON DELETE CASCADE
);
```

## Database Access Rights

The application connects as one role, and that role owns the schema. Row-level access is not delegated to the database, and that is a decision worth defending rather than glossing over.

PostgreSQL can enforce per-user visibility with row-level security policies, and for a system where the database is shared by several applications that would be the right choice. Here it would mean one database role per application user, created at registration and dropped at deletion, with the connection pool switching role per request. The cost is a second identity system that must be kept in step with the first, and a failure mode, the two drifting apart, that is worse than the one being defended against.

What the system does instead is enforce ownership at exactly one place per request, in the FastAPI dependency that resolves the token, and then filter every query by the identity that dependency returns. The dependency is the only way a handler obtains a user, so a handler cannot accidentally serve an unauthenticated request; it has no user to serve it to.

```python
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin privileges required")
    return current_user
```

Four things are checked there and each one is a distinct way of being wrong: no credentials at all, a token that does not decode or has expired, a token whose subject is not a valid identifier, and a valid token for a user who has since been deleted or disabled. The last is the one that is easy to omit: a token remains cryptographically valid for its whole lifetime, so a deactivated account must be checked against the database on every request rather than trusted from the token alone.

`require_admin` is built on `get_current_user` rather than beside it, so an administrative endpoint cannot be authorised without first being authenticated. Chapter 6 gives the full access-rights matrix.

## Coding Standards and Conventions

The codebase follows one set of conventions throughout, and they are listed here because consistency is only a virtue if it is describable.

Table: Conventions the code is written to

| Area | Convention |
|---|---|
| Python style | PEP 8, four-space indent, 100-column soft limit |
| Python naming | `snake_case` for functions and variables, `PascalCase` for classes, a leading underscore for module-private helpers |
| Type hints | On every function signature; modern union syntax (`str \| None`) throughout |
| Docstrings | On every module and every non-obvious function, stating what it does and why, not how |
| JavaScript style | ES2022 modules, `camelCase`, `PascalCase` for components, no default exports except for components |
| React | Function components with hooks only; no class components |
| CSS | Custom properties for every colour, space and radius; component classes, no inline styles except for computed geometry |
| SQL | Never assembled by string concatenation; every query goes through the ORM or a bound parameter |
| Errors | An `HTTPException` with a status code and a sentence a user can act on, never a bare `raise` |
| Secrets | Read from the environment through one settings object; never a literal in the source |

One convention is unusual enough to justify itself: **comments explain why, not what.** A comment that restates the line beneath it is noise that has to be maintained. A comment recording that a fixed progress table was tried and froze the bar during OCR is information that cannot be recovered from the code, and the codebase carries a good many of that second kind. Several of them are quoted in this report, and they are quoted because they are the record of a decision.

## The Code That Carries the System's Logic

Four excerpts follow. They are not the largest pieces of the system; they are the four places where a wrong line would change what the system *is* rather than merely break it.

### The Relevance Gate

This is the control that makes the system's central claim true. It sits between retrieval and generation, and on the branch it takes, no language model is called.

```python
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
```

Three details in twenty lines are worth naming. The scope narrows twice and the second narrowing is *checked*. A document identifier that is not in the project's set is refused rather than quietly used, which is what stops a project's guarantee being bypassed by a request. `top_score` is taken from `results[0]` because the search returns its results ordered by relevance, so the best score is the first one. And the not-found reply still reports `len(results)` and `top_score`, so the query log records what was retrieved even on the branch where nothing was used. Which is what made it possible to calibrate the floor against real questions rather than guessing it.

### The Filtered Vector Search

The scope filter is passed into the search rather than applied to its output, and the difference is the whole security property.

```python
    k = k or settings.RETRIEVAL_TOP_K
    embeddings = get_embeddings()
    query_vec = embeddings.embed_query(query)

    # Chroma requires $and to combine multiple metadata conditions.
    if document_ids:
        match = (
            {"document_id": document_ids[0]}
            if len(document_ids) == 1
            else {"document_id": {"$in": list(document_ids)}}
        )
        where = {"$and": [{"user_id": user_id}, match]}
    else:
        where = {"user_id": user_id}

    res = get_collection().query(
        query_embeddings=[query_vec],
        n_results=k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
```

`user_id` is in the `where` clause unconditionally. There is no code path through this function that searches without it, which means a caller cannot forget it. The only thing a caller controls is whether the search is narrowed *further*. The single-document case is special-cased to a plain equality rather than an `$in` of one element because Chroma treats the two differently in its query planning, and the single-document scope is the common case when a user is reading one file.

The score returned is `1 − distance`, converting Chroma's cosine distance into a relevance where higher is better, so that the floor in the previous excerpt reads the way a person would expect.

### The Progress Reporter

The progress bar is honest because this object is. It is quoted here with its docstring, because the docstring is the design.

```python
class _Progress:
    """Records where a document currently is in the ingest pipeline.

    Each stage is given the slice of the 0-100 bar running from wherever the
    previous stage finished up to its own END. Allocating the start dynamically
    (rather than from a fixed table) is what keeps the bar continuous whether or
    not OCR runs: a scanned PDF finishes reading at 35 and OCR then owns 35->60,
    while a text PDF simply lets chunking take that room instead. A fixed table
    would either leave a visible jump or, worse, hand OCR a span the extraction
    pass had already consumed -- which silently froze the bar for the whole of
    the slowest phase.
    """

    # Percent at which each stage finishes.
    END = {"extracting": 35, "ocr": 60, "chunking": 68, "embedding": 85, "indexing": 99}

    def __call__(self, stage: str, frac: float = 0.0,
                 detail: str | None = None, force: bool = False) -> None:
        """frac is 0..1 *within* `stage`. Progress only ever moves forward, so
        the client can interpolate between polls without the bar going backwards."""
        doc = self.doc
        if stage != doc.stage:
            self.start = doc.progress or 0
        end = self.END.get(stage, 100)
        lo = min(self.start, end)
        pct = int(lo + (end - lo) * max(0.0, min(1.0, frac)))
        pct = max(doc.progress or 0, pct)
        # Nothing visible changed -> skip the write, so a 500-page document does
        # not cause 500 commits.
        if not force and stage == doc.stage and pct == (doc.progress or 0):
            return
        doc.stage = stage
        doc.processing_status = _COARSE.get(stage, "processing")
        doc.progress = pct
        if detail is not None:
            doc.stage_detail = detail[:120]
        self.db.commit()
```

Three properties are enforced here rather than hoped for. Progress is **monotonic**: `pct = max(doc.progress or 0, pct)` means the bar cannot go backwards, which is what lets the client smooth between one-second polls. Writes are **suppressed when nothing changed**, which is why a five-hundred-page document does not produce five hundred commits. And `stage_detail` is **truncated to 120 characters** at the point of assignment rather than trusted to fit, because the column is `varchar(120)` and a filename can be longer than anybody expects.

### The Provider Factory

Fourteen lines is the whole of the mechanism by which the model can be changed per request.

```python
class LLMProvider(ABC):
    name: str
    model_name: str

    @abstractmethod
    def chat_model(self) -> BaseChatModel:
        """Return a LangChain chat model instance."""

    def generate(self, prompt: str) -> str:
        return self.chat_model().invoke(prompt).content


def get_provider(provider: str | None = None, model: str | None = None) -> LLMProvider:
    """Factory: resolve a provider name to a concrete LLMProvider."""
    provider = (provider or settings.DEFAULT_LLM_PROVIDER).lower()
    if provider == "openai":
        return OpenAIProvider(model)
    if provider == "ollama":
        return OllamaProvider(model)
    raise ValueError(f"Unknown LLM provider: {provider!r}")
```

Adding a third provider is one subclass and one line in the factory. Nothing else in the system knows how many there are: the router validates the name against a list it owns, the engine asks the factory, and the prompt builder consults `llm.name` in exactly one place, for the `qwen3` reasoning switch.

## Efficiency

Four things in this system are fast because they were made fast, and the rest is fast enough because it was left alone. Both halves of that are decisions.

**The embedding model is loaded once per process.** `get_embeddings()` is decorated with `lru_cache`, so the 90 MB model is materialised on first use and reused for every subsequent call. Without it, a document of two hundred chunks would load the model four times over, once per batch.

**Embedding and indexing are batched at 64.** Embedding one chunk at a time wastes the vectorised path in the model entirely; embedding all of them at once holds every vector in memory before any is written. Sixty-four is large enough to amortise the per-call overhead and small enough that the progress bar moves several times for an ordinary document.

**The retrieval filter is pushed into the index.** Discussed above as a security property; it is also the efficiency one. A top-5 computed over one user's chunks is a different amount of work from a top-5 computed over everybody's and then filtered.

**Progress writes are suppressed when nothing visible changed.** One line in the reporter, and it is the difference between a commit per page and a commit per percentage point.

What was deliberately *not* optimised is as much of the design. Conversation history is loaded with a plain query and no cache, because a conversation is small and a stale cache would show a user their own message missing. The document list is not paginated, because a personal library of a few hundred documents renders in one response and pagination would add state to the interface for no gain. And no attempt is made to cache answers, because two identical questions asked a week apart should see the library as it is on each day, not as it was.

## Error Handling

The system distinguishes four kinds of failure and handles each differently, because collapsing them is what produces the error message that tells a user nothing.

**A bad request** is rejected at the boundary with a 4xx and a sentence naming the problem. Pydantic validates the shape of every request body; explicit checks handle what a schema cannot express.

**A dependency that is not available** is reported as itself. Before retrieval runs, the engine asks whether the chosen provider is reachable and configured, and a failure produces a message naming the provider and the reason. A missing key, a key without credit, a model that has not been pulled, a service that is not running. This check exists because without it a provider failure surfaced as *"I couldn't find anything in your documents"*, which is worse than unhelpful. It blames the user's library for the system's own outage.

**A failure inside a document's ingestion** is recorded on that document and affects nothing else. The pipeline wraps its work in a single handler that writes the reason onto the row and re-raises, so the worker exits non-zero and the parent records that too:

```python
    except Exception as exc:  # noqa: BLE001 - record failure for the user/admin
        document.error_message = str(exc)[:500]
        # Leaves `progress` where it stopped, so the UI can mark the failure on
        # the step that actually broke instead of resetting the whole bar.
        report("failed", 0.0, force=True)
        raise
```

Leaving `progress` where it stopped is the detail that makes the failure diagnosable: a document that failed at 38 % failed during extraction, and one that failed at 90 % failed during indexing, and the user can see which without reading a log.

**An unexpected exception** propagates to FastAPI's handler and becomes a 500. It is not caught and disguised as success. A broad `except` that swallows an error is how a system comes to have no idea what is wrong with it.

## Parameter Passing

Three conventions govern how values move through the code, and each rules out a class of mistake.

**Keyword arguments across module boundaries.** `answer_query` takes eleven parameters and every call site names all of them. A positional call would be unreadable and, worse, silently wrong the moment a parameter is inserted.

**Immutable defaults, and `None` for absence.** No mutable default argument appears anywhere in the codebase. Where a list parameter is optional it defaults to `None`, and the distinction is used: in `answer_query`, `document_ids=None` means *the whole library* while `document_ids=[]` means *a project with nothing attached*, and the two produce different answers. A default of `[]` would have made those two states indistinguishable.

**Objects, not identifiers, once ownership has been checked.** A handler resolves an identifier to a row, checks that the row belongs to the caller, and then passes the object. This means the ownership check happens once, at the boundary, and a function receiving a `Document` can rely on it having been made.

## Validation

Validation happens at three layers, and the layering is intentional: each catches what the layer above cannot.

**At the schema layer**, Pydantic models validate the shape and type of every request body and reject anything malformed before a handler runs.

**At the handler layer**, the checks a schema cannot express are made explicitly. The upload endpoint is the clearest example:

```python
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type '.{ext}'. Allowed: pdf, docx, txt",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds {settings.MAX_UPLOAD_MB} MB limit",
        )
```

The extension is derived defensively. A filename with no dot, or no filename at all, yields an empty extension that fails the membership test rather than raising an index error. The size is checked **after** reading, because the declared `Content-Length` of a multipart upload is a claim by the client and not a fact. And the empty-file case is separated from the too-large case, because they are different mistakes and deserve different sentences.

**At the database layer**, the check constraints in §4.1 catch anything that reaches the row by a path the first two layers do not cover: a migration, a script, or a future endpoint written without them. A file type outside the four allowed cannot be stored even if every check in Python were removed.

The stored file name is also worth noting: an upload is written as `{uuid4}.{ext}` inside a directory named for the owner's identifier, never under the name the client supplied. A user-supplied filename is a path traversal waiting to happen, and it is kept as data in `original_filename` rather than used as a path.
