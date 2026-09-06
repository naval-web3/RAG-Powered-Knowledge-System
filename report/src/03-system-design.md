# System Design

## Modularisation

The system is divided into seven modules. The division is not cosmetic: each module owns a distinct kind of state, each has one reason to change, and the dependencies between them run in one direction only.

Table: The seven modules, what each owns, and where it lives

| Module | Responsibility | Principal source |
|---|---|---|
| M1 Authentication and Access Control | Registration, login, tokens, password reset, roles, and the dependency that every protected route hangs off | `api/auth.py`, `security.py`, `deps.py` |
| M2 Document Management | Accepting, validating, listing, reading, renaming, pinning and deleting documents | `api/documents.py` |
| M3 Ingestion Pipeline | Extraction, optical character recognition, section detection, chunking, and progress reporting | `services/document_processor.py`, `worker.py` |
| M4 Vector Store and Embeddings | The embedding backend, the Chroma collection, indexing, filtered search, and deletion by document or user | `services/vector_store.py`, `services/embeddings.py` |
| M5 RAG Engine | The decision of whether to retrieve at all, the relevance floor, prompt construction, generation and cleaning | `services/rag_engine.py`, `services/llm_providers.py` |
| M6 Conversation, Project and Settings | Conversations and messages, projects and their document scope, standing instructions and preferences | `api/chat.py`, `api/projects.py`, `api/settings.py` |
| M7 Administration and Analytics | Counts, the query log, the live health of every dependency, the user list | `api/admin.py`, `api/usage.py` |

The approved proposal also names seven modules, and the two lists are not identical. The proposal counts the ReactJS front end as one module and does not separate the vector store from the pipeline that fills it. This report separates them and describes the front end as a design concern in §3.6 rather than as a backend module. The reason is the one the rest of this chapter turns on: the vector store is the only component two other modules both write to and read from, so making it a module of its own is what allows the rule in §3.1 that nothing else may talk to Chroma. The mapping is one to one apart from that split.

Table: The proposal's modules, and where each one lives in this design

| Module in the approved proposal | Where it is in this report |
|---|---|
| 1. Authentication Module | M1, unchanged |
| 2. Document Management Module | M2, unchanged |
| 3. Document Processing Pipeline Module | M3, with the vector store and the embedding backend lifted out into M4 |
| 4. RAG Query Engine Module | M5, unchanged |
| 5. Conversation Management Module | M6, which also carries projects and settings, neither of which the proposal has |
| 6. Frontend UI Module (ReactJS) | Described as design in §3.6 and shown in Chapter 8, rather than as a backend module |
| 7. Admin Dashboard Module | M7, unchanged |

Three properties of that division are worth stating, because each was chosen and each has a cost.

**No module reaches upward.** M5 does not know that HTTP exists; it takes a question and returns an answer. M4 does not know what a conversation is. M3 does not know who the user is beyond a `user_id` it writes into metadata. The practical consequence is that the RAG engine can be exercised from a script with no web server running, which is how the retrieval measurements in §5.5 were taken.

**M4 is the only module that talks to Chroma.** Every read and every write of a vector goes through `vector_store.py`. This was not merely tidy; it turned out to be load-bearing. Opening the Chroma index from a second process while the backend holds it desynchronises the index — a lesson learned the expensive way, described in §5.6 — and a single choke point is what makes that rule enforceable rather than merely advisory.

**M5 has no persistence of its own.** The engine writes nothing. Its caller stores the message, the sources and the log row. That is why private mode (FR-24) needed no change to the engine at all: the router simply does not write what the engine returns.

The cost of the division is one extra indirection on every request — a router calls a service which calls a provider — and it is worth paying, because it is what allowed the language model provider to be changed per request without any router knowing.

## Procedural Design

### The Two Algorithms

The system has exactly two algorithms of any substance. Everything else is create, read, update and delete over a relational schema.

The first turns a file into searchable vectors. The second turns a question into a grounded answer. They meet only in the vector store: the first writes what the second reads, and neither calls the other.

### Why Ingestion Runs in Its Own Process

Ingestion is started by the upload endpoint and runs to completion without the user waiting. Three ways of doing that were considered, and the one chosen is the least obvious.

**A background task in the web server** is what FastAPI offers first, and it was tried first. It fails badly. Extraction and embedding are synchronous, CPU-bound work; running them in the server's thread pool occupies a worker thread for the whole of a large document, and under a second upload the pool can deadlock. The observed symptom was uploads stuck on `processing` for ever, with no error anywhere, because nothing had failed — the work had simply never been scheduled.

**A task queue** — Celery with a broker — is the industrial answer and is the wrong shape here. It introduces a second service to install, a broker to configure and a worker to keep running, in a system whose central design goal is that it installs on one machine with no network.

**A separate operating-system process**, spawned per upload, is what the system does. `api/documents.py` starts `python -m app.worker <document_id>` as a child process and returns 201 immediately. The child opens its own database session, runs the pipeline, writes progress as it goes, and exits.

That choice buys three properties that neither alternative offers together. A hung extraction cannot block the API, because it is not in the API's process. A crash — including a native crash inside a PDF parser or an OCR engine — takes down only that upload, and the non-zero exit status is caught and recorded on the document row. And there is no new service to install, because the child is the same Python interpreter that is already running.

### Extraction, Section Detection and Chunking

The pipeline's job is to turn a file into chunks that are worth retrieving. Each of its four steps makes a decision that affects the quality of every later answer.

**Extraction is per page, and the page number is kept.** Text is pulled out one page at a time and the page number travels with it all the way into the vector store's metadata. This is what allows a citation to say *page 7* rather than *somewhere in this document*, and it is the reason extraction is not simply a call that returns one long string.

**Optical character recognition is conditional and is announced.** If a PDF page yields no selectable text, the page is rendered at 240 dpi and recognised with RapidOCR. The condition matters: OCR is by far the slowest step in the pipeline, and running it on every page to guard against the occasional scan would make every ordinary document slow. It is also announced, because a document that is going to take two minutes rather than four seconds should say so — the stage becomes `ocr` and the detail line reads, for example, *scanned PDF — running OCR on 11 page(s)*.

**Sections are detected before the text is split.** Before chunking, the page text is scanned for lines that look like headings — short lines, title case or all capitals, no terminal full stop — and the text is divided at them. Each resulting piece carries the heading above it. The consequence is visible in the interface: a citation can say *§4.2 Leave Entitlement* rather than only a page number, and a user checking an answer lands on the right paragraph rather than the right page.

**Chunks are 1000 characters with 200 of overlap.** The splitter is recursive, preferring to break at a blank line, then at a line break, then at a sentence end, then at a space, and only splitting mid-word if it has no alternative. The two numbers were chosen against each other:

- **1000 characters** is roughly a paragraph and a half. Much smaller and a chunk stops containing a complete thought, so a retrieved passage answers half a question. Much larger and the embedding is an average of several topics, which makes it a weaker match for any one of them, and the retrieved passage becomes something the user has to read rather than something they can check at a glance.
- **200 characters of overlap** — a fifth of the chunk — exists for the sentence that straddles a boundary. Without overlap, a fact stated in the last line of one chunk and qualified in the first line of the next is indexed twice, incompletely, and matches neither. The cost is that the index is about twenty per cent larger than it would otherwise be, which for a library of this size is tens of megabytes.

**Embedding and indexing are separate, batched steps.** The chunks are embedded in batches of 64, and then indexed in batches of 64. Doing them as two passes rather than one is deliberate: they are two distinct pieces of real work with very different speeds, and reporting them separately is what lets the progress bar show true per-batch movement instead of one long opaque pause between 68 % and 99 %.

### Retrieval and the Relevance Floor

Retrieval is four steps, and the third is the one that makes the system trustworthy.

1. **The question is embedded** by the same model that embedded the chunks. This is not an implementation detail but the whole basis of the method: a question and a passage are comparable only because they are points in the same space, produced by the same function.
2. **The index is searched with the scope already applied.** The filter — this user, and optionally this project's documents or this one document — is passed *into* the Chroma query as a metadata condition, not applied to the results afterwards. Passages outside the scope are therefore never candidates, which matters both for correctness and for security: a filter applied after the fact can be forgotten, and a top-*k* computed over everything and then filtered returns fewer than *k* results without saying so.
3. **The best score is tested against a floor of 0.15.** Chroma returns cosine distance; the system reports relevance as `1 − distance`, so higher is better. The floor was calibrated against the test corpus, where questions genuinely covered by a document score about 0.28 and above while off-topic questions score below 0.10. Below the floor the system reports that it found nothing **and does not call the language model**. This is the single control that separates a system which says *I don't know* from one that invents.
4. **The passages are formatted with their citations.** The chunk texts are joined into one context block, and a parallel list of citations is built carrying the document title, page, section, relevance score and a 200-character snippet.

The order of steps 3 and 4 is the point. Nothing is generated until the retrieval has been judged, and a judgement made on a number cannot be talked out of by a prompt.

## Database Design

### Normalisation

The relational schema is in third normal form. Rather than assert that, it is worth walking the three conditions over the two tables where the argument is not trivial.

**`documents` is in 1NF** — every attribute holds a single value, and there is no repeating group. The temptation avoided here was a `pages` or `chunks` column holding a list; chunks live in the vector store, and the count is a scalar.

**It is in 2NF** — the key is the single attribute `document_id`, so no non-key attribute can depend on part of the key. This is the ordinary consequence of using surrogate keys throughout.

**It is in 3NF** — no non-key attribute determines another. The pair that could have broken this is `processing_status` and `stage`: `stage` determines `processing_status`, since `stage = 'chunking'` always means `processing_status = 'processing'`. That is a transitive dependency, and it is present deliberately. Removing it would mean deriving the coarse status in every query that filters on it, and the whole reason the coarse column exists is that it is cheap to index and filter. The denormalisation is one column wide, is maintained in exactly one place — the progress reporter — and is documented here rather than hidden.

**`messages` is the other interesting case.** `source_documents` holds a JSON structure, which looks at first like a violation of 1NF. It is not, because the structure is not a repeating group of the entity's own attributes; it is a record *about* an answer, whose shape belongs to the answer and not to the schema. Normalising it into a `message_sources` table was considered and rejected: the citations are written once and read as a unit, never queried by their parts, and a join returning five rows to render one message buys nothing. Where they *are* queried by their parts — the response time, the chunk count, the provider — those are separate scalar columns on `query_logs`.

**`project_documents` exists because 1NF requires it.** A project's set of documents is a repeating group; resolving the many-to-many relationship into a link table whose key is the pair of foreign keys is the standard and correct treatment.

### Integrity Constraints

Integrity is enforced in the database, not only in the application, because a constraint that lives only in Python is a convention rather than a guarantee.

Table: Constraints declared in the schema

| Constraint | Table | What it prevents |
|---|---|---|
| `ck_users_role` | `users` | A role other than `user` or `admin` ever reaching the row, whatever a client sends |
| `ck_documents_file_type` | `documents` | A file type outside `pdf`, `docx`, `txt`, `md` being recorded, even if the upload check were bypassed |
| `ck_documents_file_size` | `documents` | A zero or negative size, which would mean an empty file was accepted |
| `ck_documents_status` | `documents` | A status outside the five values the state model allows |
| `ck_messages_role` | `messages` | A message that is neither the user's nor the assistant's |
| `ck_projects_doc_scope` | `projects` | A scope other than `all` or `selected` |
| unique on `users.username` | `users` | Two accounts with the same display name |
| unique on `users.email` | `users` | Two accounts with the same login identifier |

Referential integrity is declared with an explicit delete rule on every foreign key, and the rule differs by intent. Data belonging **to** a user cascades: deleting a user deletes their documents, conversations, projects and reset tokens, and deleting a conversation deletes its messages. Data **about** the system does not: `query_logs.user_id` and `query_logs.conversation_id` are `ON DELETE SET NULL`, so closing an account does not rewrite the operational record. `conversations.project_id` is also `SET NULL`, so deleting a project releases its conversations into the general library rather than destroying them.

### Indexes, and Why Each One Exists

Every index in the schema exists because a specific query needs it. There are no speculative indexes.

Table: Indexes and the query each serves

| Index | Query it serves |
|---|---|
| `users.email` | Login. The only lookup by email, and it happens on every authentication. |
| `documents.user_id` | The library page: every document belonging to this user. |
| `documents.processing_status` | The library's polling: every document of this user that is not yet `done`. |
| `conversations.user_id` | The sidebar: this user's conversations. |
| `conversations.project_id` | A project's conversations, and the `SET NULL` sweep when a project is deleted. |
| `conversations.updated_at` | The sidebar's sort order, which is most-recently-touched first. |
| `messages.conversation_id` | Loading one conversation's transcript. |
| `projects.user_id`, `projects.updated_at` | The projects page and its ordering. |
| `password_reset_tokens.user_id` | Finding a user's outstanding reset codes. |
| `query_logs.created_at` | The administrator's dashboard, which reads this table newest-first. |

### The Vector Store

Chroma holds one collection. Every chunk in it carries its embedding, its text, and seven metadata fields.

Table: The metadata carried by every indexed chunk

| Field | Purpose |
|---|---|
| `document_id` | Ties the chunk to its row, and is what deletion works on |
| `user_id` | The filter that makes a search see only its owner's chunks |
| `title` | Lets a citation name the document without a database round trip |
| `file_type` | Lets the reader open the right viewer for the source |
| `page_number` | The page a citation points at |
| `section` | The heading a citation names, or an empty string where the page had none |
| `chunk_index` | The chunk's order within its page, which is what puts a document's chunks back in reading order |

Two design points follow from that table.

The **`user_id` in the metadata is a security control, not a convenience.** It is the mechanism by which one user's search cannot see another user's chunks, and because it is applied inside the query it holds even if a caller passes a document identifier belonging to somebody else — the conjunction simply matches nothing.

The **`title` and `file_type` are deliberately duplicated** from the `documents` row. This is denormalisation across two different stores, and it is justified by what it saves: rendering five citations would otherwise mean five lookups, or one join that the vector store cannot perform at all, on the hot path of every answer.

### The Stored Citation Record

When an answer is stored, its citations and its retrieval metadata are written onto the message itself, as JSON, in the shape below.

```json
{
  "sources": [
    {
      "document_id": "3f7c…",
      "title": "Employee Handbook 2026",
      "page_number": 7,
      "section": "4.2 Leave Entitlement",
      "chunk_index": 2,
      "snippet": "Casual leave shall be credited at the rate of …",
      "score": 0.4123
    }
  ],
  "meta": {
    "provider": "ollama",
    "model": "llama3.2:3b",
    "ms": 4187,
    "chunks": 5,
    "top_score": 0.4123
  }
}
```

Storing this with the message rather than only in the query log is a decision that came out of use. A conversation is reloaded from `messages`; without the sources on the message, the retrieval line and the sources panel could only ever be rendered on an answer the user had watched arrive, and reopening a chat from yesterday would show a bare paragraph with no provenance at all. The duplication with `query_logs` is intentional and the two serve different readers: the message serves the user reading their own history, the log serves the administrator measuring the system.

### The Embedding Design

The system embeds with `all-MiniLM-L6-v2` by default, producing 384-dimensional vectors, and can be configured to use OpenAI's `text-embedding-3-small` at 1536 dimensions instead.

Three properties of the local model decided the choice. It is **small** — 90 MB, which downloads once and then works offline for ever. It is **fast enough on a CPU** that embedding a ninety-page document is seconds rather than minutes, which matters because the reference machine's 4 GB of video memory is wanted by the language model. And its **384 dimensions** keep the index small: a library of a few hundred documents is tens of megabytes, so the whole system fits on a CD alongside its source.

One constraint follows from having two options, and it is absolute: **the embedding backend cannot be changed once documents are indexed.** A 384-dimensional query vector cannot be compared with 1536-dimensional chunk vectors, and a mixed collection is not repairable by any query. The setting is therefore a deployment-time decision, and changing it requires re-indexing every document. This is stated in the installation guide rather than left to be discovered.

## The RAG Engine

### What the Engine Decides Before It Retrieves

The engine's first responsibility is to decide whether retrieval is the right response at all. Four situations are answered without any search, and each exists because the alternative was observed to be worse.

**A greeting.** *"hi"* is not a question about the documents. Embedding it and returning the five nearest passages produces five irrelevant passages and an answer built from them.

**No documents at all.** A user who has uploaded nothing gets a direct instruction to upload something, not a search over an empty index.

**A project with nothing attached.** This one is a deliberate refusal. The engine does *not* fall back to the wider library, because the entire purpose of a project is that it cannot answer from documents the user did not put in it. Silently widening the scope would be the single most damaging thing the system could do to its own guarantee.

**A question about the conversation.** *"what did you just say?"* or *"say that in Hindi"* is about the transcript, not the documents. Retrieval is skipped rather than merely ignored — and the reason is empirical. A small model handed both *"answer using ONLY the excerpts"* and a set of excerpts that have nothing to do with the question first decides it has nothing to say, and then applies the not-found line to an exchange it answered itself a moment earlier. The transcript path uses a different system prompt with the excerpt rules left out altogether rather than softened.

### The Prompt, and What It Forbids

The prompt is built in layers, and the order of the layers is the design.

At the bottom sit the **grounding rules**, which never change and which every other layer is explicitly told it cannot override: answer using only the excerpts provided; give a complete answer that covers everything relevant in them; do not name the document, page or section in the answer text, because the source is shown separately; and if the answer is not in the excerpts, say so.

Above them sit the **project's standing instructions**, then the **user's standing instructions**, then the **work role**, then the **language line**. These may set role, tone, format and task. The preamble that introduces them says, in the prompt itself, that they cannot override the rules below.

The layering order is not arbitrary. The project's instructions come before the user's because the project is the narrower scope: inside a project, the project has the last word. The language line comes last in the preamble so that anything the user actually wrote can overrule it.

Two mechanical details in the prompt exist because of specific failures.

**Earlier turns go in as real messages, not as text folded into the system prompt.** A prompt template treats braces as variables; a question or an answer containing a brace, folded into the template as text, becomes a template error. Passing history through a message placeholder means the earlier turns are values, not templates.

**The instruction that stops the model naming its sources is load-bearing.** Without it, answers read *"According to page 7 of the Employee Handbook, …"* while the sources panel directly beneath said the same thing again. The citation is a piece of interface, and the model's job is the prose.

### The Provider Abstraction

`LLMProvider` is an abstract class with one abstract operation, `chat_model()`, and one concrete one, `generate()`. `OllamaProvider` and `OpenAIProvider` implement it, and `get_provider(name, model)` resolves a request's choice to an instance.

The abstraction is thin on purpose. It does not attempt to normalise the differences between providers beyond returning a LangChain chat model, because the differences that matter are not in the call — they are in what goes wrong. A provider that is not running, a missing API key, a key with no credit and a model that has not been pulled are four different failures, and each is reported to the user in those words rather than as a generic error or, worse, as *"I couldn't find anything in your documents"*. The health check that produces those messages runs **before** retrieval, so that a provider failure is never mistaken for an empty library.

One provider-specific accommodation survives in the prompt builder: models in the `qwen3` family run a slow internal reasoning pass by default, and the builder appends the `/no_think` switch for them. It is confined to one line and is named for what it is.

## Interface Design of the REST API

The API is 39 endpoints across seven routers, and it follows one set of rules throughout.

- **Resources are nouns and the verb is the method.** `POST /api/documents` uploads, `GET /api/documents/{id}` reads, `PATCH /api/documents/{id}` renames or pins, `DELETE /api/documents/{id}` removes. There is no `/api/deleteDocument`.
- **`PATCH` is partial and means it.** A conversation can be renamed without resending its project, its pinned state or its title.
- **Status codes carry meaning.** 201 on creation with the created resource; 204 on a delete that returns nothing; 400 for a malformed request; 401 for a missing or expired token; 403 for a valid token without the right; 404 for something that does not exist *or does not belong to the caller*, which is deliberate — a 403 on somebody else's document would confirm that it exists.
- **Ownership is a server concern.** Every handler that touches user-owned data filters by the authenticated identity taken from the token, never by an identifier in the request body.
- **Errors say what to do.** `File exceeds 25 MB limit` and `Unknown provider 'gemini'. Use 'ollama' or 'openai'.` are both more useful than `400 Bad Request`, and both are what the API actually returns.

The full endpoint reference is in Appendix C.

## User Interface Design

### Layout and Navigation

The interface is eleven pages and twenty-two components. Its layout is a persistent left sidebar carrying conversations, pinned documents and pinned projects; a top bar carrying the model picker, the retrieval scope and the account menu; and a main column that is either a conversation, the document library, a document reader, a project, or the administrator's dashboard.

The sidebar is the navigation, and it is designed around the fact that a knowledge system accumulates. Conversations group by age, groups can be folded, the whole sidebar can be collapsed to icons, and anything worth keeping in reach — a document, a project — can be pinned into it.

### One Stylesheet Rather Than a Utility Framework

The approved proposal named Tailwind CSS. Tailwind remains in the build configuration from the initial scaffold and is not used; the delivered interface is styled by a single hand-written stylesheet of 3,581 lines.

The reason is that this interface is not a set of pages assembled from utilities. It is one application with a coherent visual system — a colour scale, a spacing scale, a type scale, a shadow scale — expressed as custom properties and consumed by named component classes. That system has to do two things a utility framework makes awkward: it has to switch cleanly between a light and a dark theme by swapping the values of the custom properties rather than by rewriting class lists across every component, and it has to be readable by one person maintaining it, which markup carrying fifteen utility classes per element is not.

The honest cost is that a hand-written stylesheet has no tree-shaking and no constraint stopping a new rule from duplicating an old one. At 3,581 lines that cost has not yet been paid, and the report records the decision rather than presenting the configuration file as if it were used.

### The Sources Disclosure

The sources panel is the part of the interface that carries the project's central claim, and it went through the most revision.

The final design is a three-level disclosure. Under every answer, a **retrieval line** states plainly how many passages were used, from which documents, on which model and in how many milliseconds. The passage count is itself the control: clicking it expands the **five passages**, each with its document, page, section and relevance score. Clicking one of those opens the **passage itself** in a dialog, with its four pieces of metadata on a labelled plate and the excerpt set as a quotation behind a rule.

Two decisions inside that are worth recording. The disclosure control carries no chevron: the count *is* the affordance, and removing the icon required cancelling the hover plate's padding so that the label still aligns with the retrieval line above it. And the retrieval line is always visible while the passages are not, because the claim *"this came from five passages of your handbook"* is what every user needs, and the passages themselves are what only some users will check.

![The sources panel expanded. Each passage carries the document it came from, its page, its section and its relevance score.](../docs/screenshots/09-sources-expanded.png){width=5.9}

![One passage opened. The four pieces of metadata sit on a labelled plate, and the excerpt is set as a quotation.](../docs/screenshots/10-source-passage.png){width=5.9}

### Responsiveness

The interface is responsive to 414 px without horizontal scrolling. Below the breakpoint the sidebar becomes a drawer over a backdrop, opened from the same panel icon that collapses it on the desktop and closed from the icon inside the drawer's own header.

That last detail is a fix rather than a plan. The drawer originally slid in *behind* the top bar, because the bar sits at a higher stacking level, so its own header was hidden and the drawer read as empty. The open drawer now sits above both the bar and its backdrop, which puts the opening control out of reach — hence the closing control inside the drawer, which closes the drawer without also setting the desktop collapsed state, so that widening the window does not leave the sidebar hidden.

![The interface at phone width. The sidebar has become a drawer with its own closing control.](../docs/screenshots/35-mobile-sidebar.png){width=3.1}

### Eleven Interface Languages

The interface is available in eleven languages, at 355 keys per locale. Three boundaries are drawn precisely, and the distinction matters because it is easy to overclaim here.

**What is translated** is the interface: every label, button, heading, menu item, empty state and error message.

**What is not translated** is the documents, the answers and the stored data. Retrieval is over English documents with an English embedding model, and the answer comes back in the language the model was asked for — which is a request in the prompt, not a translation layer.

**What is stored as an identifier rather than a label** is anything the system reasons about later. A user's work role is stored as its identifier and never as its displayed name, so that changing the interface language does not change what the prompt says about that user.

![The language picker. Eleven interface languages; the documents and the answers are a separate question.](../docs/screenshots/23-language-picker.png){width=5.5}

## Deployment Architecture

The whole system is one machine. The deployment diagram makes the claim that matters visible: **the only line that crosses the host boundary is the optional one to OpenAI.**

Inside the boundary sit two processes and three stores. Uvicorn runs the FastAPI application and holds the ORM, the Chroma client and the provider abstraction. `app.worker` is spawned per upload and exits when it is done. PostgreSQL listens on the loopback interface. ChromaDB is embedded — a directory on disk, not a service. The upload store is a directory of the original files. Ollama runs as its own process on the same machine and is reached over the loopback interface on port 11434.

A Docker Compose configuration is provided and defines three services — `postgres`, `backend` and `frontend` — with three named volumes for the database, the uploads and the Chroma index. It is a convenience for deployment, not the reference environment; the system as tested and measured in Chapter 5 runs directly on the host.

<!-- landscape -->

![The deployment architecture. Everything inside the dashed boundary runs on one machine; the dashed link to OpenAI is the only traffic that ever leaves it, and it is optional.](assets/diagrams/deployment.png){width=9.4}

<!-- portrait -->

## The Design Decisions, in One Place

Six decisions in this chapter shaped everything else, and each was taken against a named alternative.

Table: The design decisions, and what each was chosen over

| Decision | Chosen over | Because |
|---|---|---|
| Ingestion in a separate process | A background task in the web server; a Celery queue | The task deadlocked the thread pool and hung uploads; the queue needs a broker, a worker and a network, in a system built to need none |
| A relevance floor before generation | Trusting the prompt's instruction to refuse | A prompt can be ignored by a model; a call that is never made cannot be |
| Chunks of 1000 with 200 of overlap | Smaller chunks; no overlap | Smaller chunks stop containing a complete thought; without overlap a fact split across a boundary matches nothing |
| The scope filter applied inside the search | Filtering the results afterwards | An after-the-fact filter can be forgotten, and it silently returns fewer than *k* |
| Citations stored on the message | Only in the query log | A reopened conversation is rebuilt from `messages`, and without them yesterday's answer has no provenance at all |
| One hand-written stylesheet | The Tailwind configuration in the scaffold | The interface needs a themeable custom-property system, and the proposal's choice is recorded as unused rather than presented as used |
