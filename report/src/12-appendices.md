# Appendices

## Appendix A: Installation

The submitted media carries a full installation guide as `INSTALL.md`, written for a machine that has never had any of this software on it. What follows is the shape of that procedure and the three points at which it is easiest to go wrong.

### What Gets Installed, and What Listens Where

Table: The four processes, and the ports they use

| Component | Listens on | Required? |
|---|---|---|
| PostgreSQL 16 | 5432 | Yes |
| Ollama | 11434 | Only for local models; not needed if the OpenAI provider is used |
| Backend (Uvicorn) | 8000 | Yes |
| Frontend (Vite) | 5173 | Yes |

### The Procedure

1. **Prerequisites.** Python 3.12, Node 20, PostgreSQL 16 and, for local models, Ollama.
2. **Copy the project to a writable drive.** It cannot run from the disc, because the vector store, the upload directory and the database all need to be written to.
3. **Restore the application data**, which brings the seeded documents, conversations and vector index with it.
4. **Create the database and restore the dump.**
5. **Create the environment file** from the template, and set the signing secret. There is no key in the shipped file, by design.
6. **Create the Python environment** and install the pinned requirements.
7. **Install the front-end dependencies.**
8. **Pull a language model**, `ollama pull llama3.2:3b`.
9. **Start the application** with `start-app.bat`.
10. **Verify** by signing in and asking a question that the seeded corpus answers.

### The Three Things That Go Wrong

**The environment file is missing or has no signing secret.** The backend will not start, and it says so. The template is shipped without a secret deliberately: §6.7 explains that the disc build fails if a real secret is found in the tree, so one has to be generated at install time.

**Ollama is running but no model has been pulled.** This is the failure that looks like a bug in the application and is not. The system reports it precisely. The health report in §7.7 says *"no models"*, and a question answered with no model pulled names the provider and the reason rather than reporting an empty library.

**The embedding backend is changed after documents are indexed.** This is the one irreversible mistake in the installation. A 384-dimensional query cannot be compared with 1536-dimensional chunks, and a mixed collection is not repairable by any query. Changing `EMBEDDING_BACKEND` requires deleting the Chroma directory and re-indexing every document.

## Appendix B: User Manual

### Getting Started

**Create an account** with a username, an email address and a password of at least eight characters. Both the username and the email must be unique.

**Upload a document** by dragging a PDF, DOCX, TXT or MD file onto the library, or from the composer inside a conversation. Ingestion begins immediately and the row shows its progress: reading, then optionally recognising a scan, then splitting, embedding and indexing. A document is answerable when its row reads *done*.

**Ask a question** in ordinary English. The answer appears with a line beneath it recording how many passages it used, from which documents, on which model and in how long.

**Check an answer** by clicking the passage count. The five passages appear, each with its document, page, section and relevance score; clicking one opens the passage itself.

### Working With a Library That Grows

**Pin** a document or a project to keep it in the sidebar. **Search** conversations from the sidebar. Conversations group by age and each group folds.

**Create a project** when a set of questions belongs to a set of documents. Give it standing instructions, attach the documents it may use, and every conversation inside it will retrieve only from those. This is a guarantee rather than a preference: a project with nothing attached says so rather than quietly searching the whole library.

**Set standing instructions** in Settings to apply to every conversation. They can set role, tone, format and task. They cannot switch off citation or the rule that answers come only from the documents.

### Controls Worth Knowing

Table: The controls that change what an answer is

| Control | Where | Effect |
|---|---|---|
| Model picker | Top bar | Which model answers this question; local and cloud models appear in one list |
| Retrieval scope | Top bar | Restricts retrieval to one document |
| Project | Sidebar | Restricts retrieval to that project's documents, and applies its instructions |
| Passages retrieved (*k*) | Settings → Model | How many passages are put in front of the model |
| Private mode | Composer | Answers normally and writes nothing: no conversation, no message, no log row |
| Interface language | Account menu | Eleven languages. The interface only, the documents and the answers are separate |

### When the System Says It Cannot Answer

Three different messages mean three different things, and telling them apart saves time.

*"I couldn't find anything about that in your documents"* means retrieval ran and nothing scored well enough. The library does not cover the question, or the question is worded very differently from the text that answers it. Try rewording it, or upload a document that covers it.

*"No documents uploaded yet"* means exactly that.

*"This project has no documents attached yet"* means the project's scope is empty. This is not the same as the first message: the system is refusing to widen the search, which is what a project is for.

A message naming a provider, that Ollama is not running, that a key is missing, or that a model has not been pulled, is about the system rather than about your library.

## Appendix C: REST API Reference

Thirty-nine endpoints across seven routers. Every endpoint except registration, login and password reset requires a bearer token. Every endpoint touching user-owned data is filtered by the authenticated identity on the server.

Table: Authentication and account (`/api/auth`)

| Method and path | Purpose |
|---|---|
| `POST /register` | Create an account; returns a token |
| `POST /login` | Authenticate; returns a token |
| `POST /forgot-password` | Issue a single-use, time-limited reset code |
| `POST /reset-password` | Set a new password with a valid code |
| `GET /me` | The current user |
| `PATCH /me` | Update profile, standing instructions or work role |
| `POST /change-password` | Change password while signed in |
| `DELETE /account` | Delete the account and everything belonging to it |

Table: Documents (`/api/documents`)

| Method and path | Purpose |
|---|---|
| `POST /` | Upload a document; returns 201 and starts ingestion |
| `GET /` | List the caller's documents |
| `GET /{id}` | One document, including its live ingestion state |
| `GET /{id}/content` | The extracted text |
| `GET /{id}/chunks` | Every indexed chunk, in reading order |
| `GET /{id}/thumbnail` | A rendered first page |
| `GET /{id}/pages` | Page count and page images |
| `GET /{id}/file` | The original file |
| `PATCH /{id}` | Rename or pin |
| `DELETE /{id}` | Delete the row, the file and every vector |

Table: Asking and conversations (`/api`)

| Method and path | Purpose |
|---|---|
| `POST /chat` | Ask a question; returns the answer with its sources |
| `POST /chat/stream` | The same, streamed |
| `GET /models` | The models the server can currently serve |
| `GET /conversations` | List the caller's conversations |
| `GET /conversations/{id}` | One conversation with its messages and their sources |
| `PATCH /conversations/{id}` | Rename, pin or mark unread |
| `DELETE /conversations/{id}` | Delete the conversation and its messages |

Table: Projects, settings and usage

| Method and path | Purpose |
|---|---|
| `GET /api/projects` | List the caller's projects |
| `POST /api/projects` | Create a project |
| `GET /api/projects/{id}` | One project |
| `PATCH /api/projects/{id}` | Rename, pin, or change instructions and scope |
| `POST /api/projects/{id}/open` | Record that the project was opened |
| `PUT /api/projects/{id}/documents` | Replace the set of attached documents |
| `DELETE /api/projects/{id}` | Delete the project; its conversations survive |
| `GET /api/settings` | The caller's preferences |
| `PATCH /api/settings` | Update them |
| `GET /api/usage` | The caller's own usage report |

Table: Administration (`/api/admin`), administrators only

| Method and path | Purpose |
|---|---|
| `GET /stats` | Counts, mean response time, and the provider and type breakdowns |
| `GET /users` | User accounts with role, status and activity |
| `GET /query-logs` | The recent query log across all users |
| `GET /system` | Live health of PostgreSQL, ChromaDB, Ollama and OpenAI |

Table: Status codes, and what each means here

| Code | Meaning in this API |
|---|---|
| 200 | Success with a body |
| 201 | Created, with the created resource |
| 204 | Success with nothing to return |
| 400 | Malformed request, with a sentence naming what is wrong |
| 401 | Missing, invalid or expired token, or a disabled account |
| 403 | A valid token without the right, administrative endpoints only |
| 404 | Not found, **or** not the caller's; the two are deliberately indistinguishable |
| 413 | Upload over the size limit |

## Appendix D: The Test Corpus

The thirty-one system test cases in §5.4 were run against three documents holding thirteen indexed chunks. The corpus is small on purpose: every chunk in it is known, so a wrong answer can be traced to a specific passage rather than guessed at.

Table: The test corpus

| Document | Organisation | Subject matter |
|---|---|---|
| `healthcare_policy_handbook.md` | Sunrise Valley Medical Center | Visiting hours, admissions, deposits, departments, pharmacy discounts, ambulance contact |
| `hr_employee_handbook.md` | NovaTech | Leave, notice periods, probation, appraisals, referral bonuses, remote-work allowances |
| `it_security_policy.md` | NovaTech | Passwords, VPN, device loss, incident response SLAs, data tiers, security contact |

Two organisations appear on purpose. §5.4.1 explains why: a single-organisation corpus cannot detect an answer that retrieves from the right document and attributes it to the wrong one, which is precisely the defect case 31 found.

The question set is on the submitted media as `docs/rag_test_questions.md`, and the results as `docs/test-results.md`. Each case was submitted through `POST /api/chat` against a running instance, recording the answer, the retrieved sources, the chunk count, the top relevance score and the elapsed time.
