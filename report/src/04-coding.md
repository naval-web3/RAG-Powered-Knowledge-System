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

The application connects as one role, and that role owns the schema. Row-level access is not delegated to the database, and that is a decision worth defending instead of glossing over.

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

Four excerpts follow. They are not the largest pieces of the system; they are the four places where a wrong line would change what the system *is* and not merely break it.

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

Three details in twenty lines are worth naming. The scope narrows twice and the second narrowing is *checked*. A document identifier that is not in the project's set is refused rather than quietly used, which is what stops a project's guarantee being bypassed by a request. `top_score` is taken from `results[0]` because the search returns its results ordered by relevance, so the best score is the first one. And the not-found reply still reports `len(results)` and `top_score`, so the query log records what was retrieved even on the branch where nothing was used. Which is what made it possible to calibrate the floor against real questions instead of guessing it.

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

`user_id` is in the `where` clause unconditionally. There is no code path through this function that searches without it, which means a caller cannot forget it. The only thing a caller controls is whether the search is narrowed *further*. The single-document case is special-cased to a plain equality, not an `$in` of one element because Chroma treats the two differently in its query planning, and the single-document scope is the common case when a user is reading one file.

The score returned is `1 − distance`, converting Chroma's cosine distance into a relevance where higher is better, so that the floor in the previous excerpt reads the way a person would expect.

### The Progress Reporter

The progress bar is honest because this object is. It is quoted here with its docstring, because the docstring is the design.

```python
class _Progress:
    """Records where a document currently is in the ingest pipeline.

    Each stage is given the slice of the 0-100 bar running from wherever the
    previous stage finished up to its own END. Allocating the start dynamically
    (and not from a fixed table) is what keeps the bar continuous whether or
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

### The Upload Handler

Validation happens three times on the way in, and the reasons differ. This is the middle one: the request has been accepted, the extension has been checked, and what is left is the two facts a client can lie about.

```python
@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    # When the upload starts from inside a project, the new document is filed
    # into it as well as the library, so the user does not have to attach it
    # by hand afterwards.
    project_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
    project: Project | None = None
    if project_id:
        project = db.get(Project, project_id)
        if project is None or project.user_id != current_user.user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type '.{ext}'. Allowed: pdf, docx, txt")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")

    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.user_id))
    os.makedirs(user_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4()}.{ext}"
    stored_path = os.path.join(user_dir, stored_name)
    # Sealed on the way to disk. file_size below stays the size of the document
    # the user uploaded, not the size of what is stored, because that is the
    # number shown in the library and counted against the upload limit.
    file_store.write(stored_path, data)

    doc = Document(
        user_id=current_user.user_id,
        title=(file.filename or stored_name),
        original_filename=file.filename or stored_name,
        file_path=stored_path,
        file_type=ext,
        file_size=len(data),
        processing_status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    if project is not None:
        db.add(ProjectDocument(project_id=project.project_id, document_id=doc.document_id))
        # An upload into a project is an explicit choice to use that file there,
        # so a project still set to "all documents" is switched to its own
        # selection rather than silently ignoring the attachment.
        project.doc_scope = "selected"
        db.commit()

    background.add_task(_run_pipeline, doc.document_id)
    return DocumentOut.model_validate(doc)
```

The size is checked **after** reading rather than from `Content-Length`, because that header is a claim by the client and not a fact. The empty file and the oversized file are separated, because they are different mistakes and deserve different sentences. And the write goes through `file_store.write`, which seals the bytes before they reach the disk, while `file_size` records the size of the document the user uploaded rather than the size of what is stored.

### The Authentication Dependency

One function, hung on every protected route, and the reason authorisation cannot be forgotten on any of them.

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
```

A signed token is valid for its whole lifetime, so an account disabled ten minutes after signing in would keep working until the token expired. That is why this resolves the subject to a row and re-checks `is_active` on every request instead of trusting the claim. The cost is one indexed primary-key lookup per request; the alternative is a disabled account that keeps working for an hour.

### Sealing a Document

Encryption at rest is a few lines of cipher and a great deal of care about the format around them.

```python
def seal(data: bytes) -> bytes:
    """Plaintext in, stored form out."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = secrets.token_bytes(NONCE_BYTES)
    return MAGIC + nonce + AESGCM(_key()).encrypt(nonce, data, None)


def unseal(blob: bytes) -> bytes:
    """Stored form in, plaintext out. Plaintext in, the same plaintext out."""
    if not is_sealed(blob):
        return blob
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    start = len(MAGIC)
    nonce = blob[start : start + NONCE_BYTES]
    return AESGCM(_key()).decrypt(nonce, blob[start + NONCE_BYTES :], None)


def read(path: str) -> bytes:
    """The plaintext of a stored file, whether or not it was sealed.

    A file that is sealed but will not open raises. That is the right outcome:
    the alternative is handing back ciphertext and letting a PDF reader report
    a corrupt document, which sends whoever is looking into it in the wrong
    direction entirely.
    """
    with open(path, "rb") as handle:
        blob = handle.read()
    if not is_sealed(blob):
        return blob
    from cryptography.exceptions import InvalidTag

    try:
        return unseal(blob)
    except InvalidTag as exc:
        raise ValueError(
            "This file is encrypted and the current key does not open it. "
            "SECRET_KEY or FILE_ENCRYPTION_KEY has changed since it was stored."
        ) from exc
```

The nonce is fresh on every write and never reused, so two copies of the same document do not produce the same ciphertext and the store does not leak which documents match. `read` returning plaintext untouched is what allows this to be introduced on an installation that already holds documents, and a file that is sealed but will not open raises rather than returning ciphertext, because handing back ciphertext would make a PDF reader report a corrupt document and send the reader after the wrong problem.

### Refresh Token Rotation

Every renewal spends the token it was given. The distinction in the middle of this function is what stops an ordinary sign-out being mistaken for a theft.

```python
@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    """Trade a refresh token for a new access token, and a new refresh token.

    The old one is spent in the process. Rotating on every use is what makes a
    stolen token detectable: the real client and the thief cannot both keep
    refreshing, and whichever presents the spent token second gives the theft
    away. When that happens every session for the account is withdrawn, which
    is heavy-handed on purpose. Losing a session is a nuisance; leaving a copied
    token working for a month is not.
    """
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(payload.refresh_token))
        .first()
    )
    if row is None:
        raise invalid

    if row.revoked:
        # Revoked for two quite different reasons, and only one of them is
        # alarming. A token with a successor was spent in a rotation and is now
        # being presented a second time, which means two clients hold it: end
        # everything. A token with no successor was withdrawn on purpose, by a
        # sign-out or a password change, and meeting it again is just a stale
        # tab. Treating the second case as theft would let signing out of one
        # tab sign the user out of every device they own.
        if row.replaced_by is not None:
            _revoke_all(db, row.user_id)
            db.commit()
        raise invalid

    if row.expires_at < datetime.now(timezone.utc):
        raise invalid

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise invalid

    token, successor = _mint_session(db, user)
    row.revoked = True
    row.last_used_at = datetime.now(timezone.utc)
    row.replaced_by = successor.token_id
    db.commit()
    return token
```

A revoked token means two quite different things. One with a successor recorded against it was spent in a rotation and is being presented a second time, which means two clients hold it. One with no successor was withdrawn on purpose, by a sign-out or a password change, and meeting it again is a stale tab. The first implementation did not draw that line, and the consequence, found by the end-to-end check and not by reading the code, was that signing out of one browser would have signed the user out of every device they owned.

### The Rate Limiter

A fixed window, counted per address, in front of every route and before authentication runs.

```python
    def hit(self, key: str, limit: int, now: float | None = None) -> tuple[bool, int]:
        """Record one request. Returns (allowed, seconds until the window ends).

        The second element is what goes in Retry-After, so a well-behaved client
        is told exactly how long to wait instead of guessing.
        """
        now = time.time() if now is None else now
        bucket = int(now // self.window)
        with self._lock:
            # Drop windows that have passed. Doing it here rather than on a
            # timer keeps the memory bounded without a background thread.
            if len(self._hits) > 4096:
                self._hits = defaultdict(
                    int, {k: v for k, v in self._hits.items() if k[1] >= bucket - 1}
                )
            self._hits[(key, bucket)] += 1
            count = self._hits[(key, bucket)]
        retry_after = int((bucket + 1) * self.window - now) + 1
        return count <= limit, retry_after
```

The counter is in the process's own memory. Redis would survive a restart and would work across several instances, and it is another service to install, run and back up on a system whose entire deployment story is one machine with no internet connection. The window resetting on restart is a real weakness and a small one, since restarting is not something an attacker can cause. It is recorded as a limit in section 6.9 rather than left for a reader to notice.

### The Streaming Route

The same pipeline as the plain chat route, delivered a token at a time so that an answer starts appearing in about a second instead of after six.

```python
def _sse(event: str, data: dict) -> str:
    return "event: %s\ndata: %s\n\n" % (event, json.dumps(data, default=str))


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
            work_role=current_user.work_role,
        ):
            if kind == "token":
                yield _sse("token", {"t": item})
            else:
                result = item  # type: ignore[assignment]

        if result is None:  # pragma: no cover - _run always ends with "done"
            yield _sse("error", {"message": "The model returned nothing."})
            return

        sources_payload = [s.model_dump() for s in result["sources"]]

        # Stored WITH the answer, not only in query_logs: the chat reloads
        # from messages, so without this the retrieval line can only ever
        # render on an answer you watched arrive.
        meta_payload = {
            "provider": result["provider"],
            "model": result["model"],
            "ms": result["response_time_ms"],
            "chunks": result["chunks_retrieved"],
            "top_score": result.get("top_score"),
        }

        if not incognito and conv_id is not None:
            own = SessionLocal()
            try:
                own.add(
                    Message(
                        conversation_id=conv_id,
                        role="assistant",
                        content=result["answer"],
                        source_documents={"sources": sources_payload, "meta": meta_payload},
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
```

The generator yields named events rather than bare text, so the client can tell a token from a citation list from a completion. Errors are yielded as events too: once the response has begun, the status code is already sent and an exception can no longer become a 500, so a failure that is not turned into an event becomes a stream that simply stops.

### Renewing a Token in the Browser

The front-end half of section 6.2. What a user sees when an access token expires is one slightly slower request, and this is why.

```javascript
export function refreshAccessToken() {
  if (inFlight) return inFlight;

  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve(null);

  // Bare axios, not `client`: a refresh that 401s must not re-enter the
  // interceptor that called it.
  inFlight = axios
    .post("/api/auth/refresh", { refresh_token: refreshToken })
    .then(({ data }) => {
      storeSession(data);
      return data.access_token;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
```

One refresh at a time, and the comment says what the alternative costs. Several requests can fail together, and each rotation spends the token it was given, so letting them all refresh at once would have the second one present a token the first had already spent. The server reads that as a stolen token and ends every session, which is the correct reading of it and exactly what the client must not provoke.

### The Response Interceptor

Where a rejected request becomes a renewed one, and where a session that is genuinely over becomes a trip to the login screen.

```javascript
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response && err.response.status === 401 && original) {
      const exempt = NO_RETRY.some((p) => (original.url || "").startsWith(p));
      if (!exempt && !original._retried) {
        original._retried = true;
        const fresh = await refreshAccessToken();
        if (fresh) {
          original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
          return client(original);
        }
      }
      // No refresh token, or the refresh was refused: the session is over. A
      // 401 from login itself is a wrong password, and the login screen is
      // already where the user is standing.
      if (!exempt) {
        toLogin();
      }
    }

    // Give client-side timeouts a readable message instead of a bare
    // "timeout of 120000ms exceeded" that leaks into the chat UI.
    if (err.code === "ECONNABORTED" && !err.response) {
      err.friendlyMessage =
        "That took too long, so we stopped waiting. The model you picked may be too slow for this machine. Try a smaller one.";
    }
    return Promise.reject(err);
  }
);
```

`_retried` is what stops this looping: a request that fails again after a successful renewal is not renewed a second time. The exempt list matters as much. A 401 from the login route is a wrong password, not an expired session, and sending the user to the login screen they are already looking at would replace a readable error with a page reload.

## Where the Complete Source Is

This chapter shows the code that carries the system's logic, and the conventions every file is written to. The backend is printed in Appendix E: thirty-four of the thirty-nine Python files counted in the table below, which is all 6,008 of its lines, because the five not printed are empty package markers. The seven test suites are among them. The eight front-end files that carry the application are printed in Appendix F.

The complete source is on the submitted disc under `02-Source-Code`, and it is
the same tree the application runs from. Its scale is worth stating plainly,
because a report that prints excerpts should say what it is drawing them from.

Table: The codebase, by size

| Part | Files | Lines |
|---|---|---|
| Backend, Python | 39 | 6,008 |
| Front end, JavaScript and JSX | 55 | 14,933 |
| Stylesheet | 1 | 3,581 |
| **Total** | **95** | **24,522** |

Appendices E and F and the excerpts in the previous section come to 10,448 of those 24,522 lines. What is not printed is the remainder of the front-end component library, the eleven locale files, which are string tables rather than logic, and the stylesheet. All of it is on the disc.

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

The extension is derived defensively. A filename with no dot, or no filename at all, yields an empty extension that fails the membership test instead of raising an index error. The size is checked **after** reading, because the declared `Content-Length` of a multipart upload is a claim by the client and not a fact. And the empty-file case is separated from the too-large case, because they are different mistakes and deserve different sentences.

**At the database layer**, the check constraints in §4.1 catch anything that reaches the row by a path the first two layers do not cover: a migration, a script, or a future endpoint written without them. A file type outside the four allowed cannot be stored even if every check in Python were removed.

The stored file name is also worth noting: an upload is written as `{uuid4}.{ext}` inside a directory named for the owner's identifier, never under the name the client supplied. A user-supplied filename is a path traversal waiting to happen, and it is kept as data in `original_filename` rather than used as a path.

The write itself goes through `file_store.write`, which seals the bytes before they reach the disk (§6.4). The recorded `file_size` stays the size of the document the user uploaded and not the size of what is stored, because that is the number shown in the library and the number the upload limit counts. The thirty-six bytes encryption adds are the storage layer's business and nobody else's.
