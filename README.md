# RAG Powered Knowledge System

A full-stack Retrieval-Augmented Generation (RAG) knowledge base. Upload
documents (PDF / DOCX / TXT), index them as vector embeddings, and ask
questions in natural language to get answers grounded in your own documents,
with source citations.

> MCA Project (MCSP-232) — IGNOU. 

## Architecture

| Layer            | Technology                                              |
|------------------|---------------------------------------------------------|
| Frontend         | ReactJS 18 + Vite + Tailwind CSS (Axios, React Router)  |
| Backend API      | Python 3.12 + FastAPI + Uvicorn                         |
| RAG orchestration| LangChain (Recursive splitter, prompt chains)           |
| LLM providers    | Ollama (local: llama3.2, qwen3.5, phi4, granite4, gemma3) **and** OpenAI |
| Embeddings       | sentence-transformers (local) **or** OpenAI embeddings  |
| Vector store     | ChromaDB (persistent / embedded, cosine similarity)     |
| Relational DB    | PostgreSQL 16                                           |
| Auth             | JWT (python-jose) + bcrypt password hashing             |

## Modules (per synopsis)

1. **Authentication** — register/login, JWT, bcrypt, role-based access (user/admin)
2. **Document Management** — upload, validate, store, list, delete
3. **Document Processing Pipeline** — extract → chunk (1000/200) → embed → store in Chroma
4. **RAG Query Engine** — semantic search (top-k) → augmented prompt → LLM → answer + citations
5. **Conversation Management** — sessions, message history, delete
6. **Frontend UI** — login, document library, chat with sources, admin dashboard
7. **Admin Dashboard** — users, documents, queries, avg response time, provider breakdown

## Prerequisites

- Python 3.12, Node.js 18+, PostgreSQL 16
- Ollama running locally with at least one model pulled (e.g. `ollama pull llama3.2:3b`)
- (Optional) An OpenAI API key for the OpenAI provider

## Setup

### 1. Database
PostgreSQL must be running with a database named `rag_knowledge`:
```sql
CREATE DATABASE rag_knowledge;
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # then edit values (DB password, OpenAI key)
# --reload-dir app watches only source code (not uploads/ or chroma_db/), so
# document processing isn't interrupted by the reloader.
uvicorn app.main:app --reload --reload-dir app   # http://localhost:8000 (docs at /docs)
```

Create an admin user:
```bash
python -m scripts.seed_admin --email admin@example.com --username admin --password secret123
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

## Configuration (.env)

Key settings (see `backend/.env.example` for the full list):

- `DEFAULT_LLM_PROVIDER` — `ollama` (local, default) or `openai`
- `OLLAMA_MODEL` — e.g. `llama3.2:3b`
- `OPENAI_API_KEY` — required only to use the OpenAI provider
- `EMBEDDING_BACKEND` — `local` (sentence-transformers) or `openai`
- `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVAL_TOP_K` — RAG tuning

## API overview

| Method | Endpoint                          | Description                       |
|--------|-----------------------------------|-----------------------------------|
| POST   | `/api/auth/register`              | Register, returns JWT             |
| POST   | `/api/auth/login`                 | Login, returns JWT                |
| GET    | `/api/auth/me`                    | Current user                      |
| POST   | `/api/documents`                  | Upload a document (multipart)     |
| GET    | `/api/documents`                  | List my documents                 |
| DELETE | `/api/documents/{id}`             | Delete a document + its vectors   |
| POST   | `/api/chat`                       | Ask a question (RAG)              |
| GET    | `/api/conversations`              | List conversations                |
| GET    | `/api/conversations/{id}`         | Conversation with messages        |
| DELETE | `/api/conversations/{id}`         | Delete a conversation             |
| GET    | `/api/admin/stats`                | Admin analytics (admin only)      |
| GET    | `/api/admin/users`                | List users (admin only)           |

## Docker (optional)

```bash
docker compose up --build
```
Brings up PostgreSQL, the backend, and the frontend. Ollama is expected to run
on the host (`host.docker.internal:11434`).
