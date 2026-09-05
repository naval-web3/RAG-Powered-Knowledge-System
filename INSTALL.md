# Installation and Setup Guide

**RAG Powered Knowledge System** — IGNOU MCA, MCSP-232

This guide takes a Windows machine from nothing to a running copy of the
application. Follow the sections in order. Sections 1–7 are a **one-time
setup**; after that, starting the app is a single double-click.

Expect the one-time setup to take **30–60 minutes**, most of it spent
downloading Python packages and the language model.

---

## What gets installed, and where it listens

| Component | Technology | Port | Role |
|---|---|---|---|
| Relational database | PostgreSQL 16 | 5432 | Users, chats, documents, projects, query logs |
| Language model runtime | Ollama | 11434 | Runs the LLM locally on your machine |
| Backend API | Python 3.12 + FastAPI | 8000 | RAG pipeline, authentication, REST API |
| Frontend | React 18 + Vite | 5173 | The web interface you use in a browser |
| Vector store | ChromaDB | *(embedded)* | Document embeddings, stored in `backend/chroma_db` |

The application runs **entirely on your own machine**. No part of it needs
to be hosted, and no document you upload leaves the computer unless you
explicitly select a cloud model.

---

## 1. Prerequisites

Install these four first. Reboot afterwards if any installer asks.

| Software | Version | Download | Disk |
|---|---|---|---|
| **Python** | 3.12.x | https://www.python.org/downloads/ | ~150 MB |
| **Node.js** | 20 LTS or newer | https://nodejs.org/ | ~100 MB |
| **PostgreSQL** | 16 | https://www.postgresql.org/download/windows/ | ~350 MB |
| **Ollama** | latest | https://ollama.com/download | ~600 MB |

> **When installing Python**, tick **"Add python.exe to PATH"** on the first
> screen of the installer. Almost every setup problem traces back to this.

> **When installing PostgreSQL**, note the password you set for the
> `postgres` superuser. You need it in step 3. This guide assumes the
> password is `rag`.

**Free disk space required: about 20 GB.** The Python environment alone is
~1.5 GB (PyTorch, for local embeddings) and the language models are 2–4 GB
each.

Verify all four are installed by opening a **new** PowerShell window and running:

```powershell
python --version      # Python 3.12.x
node --version        # v20.x or higher
psql --version        # psql (PostgreSQL) 16.x
ollama --version      # ollama version ...
```

If `psql` is not recognised, add `C:\Program Files\PostgreSQL\16\bin` to your
PATH, or use the full path to it in step 3.

---

## 2. Copy the project to a writable drive

**A CD is read-only, so the application cannot run from the disc.** Copy it
to your hard drive first.

1. Copy `02-Source-Code\rag-knowledge-system` from the CD to somewhere like
   `C:\rag-knowledge-system`.
2. Right-click the copied folder → **Properties** → untick **Read-only** →
   **OK** → apply to all subfolders. Windows sets this flag on everything
   copied from a disc, and the application must be able to write to it.

From here on, `<project>` means that copied folder.

### Restore the application data

Copy these from the CD's `03-Application-Data\` folder into `<project>`:

| From the CD | To |
|---|---|
| `uploads\` | `<project>\backend\uploads\` |
| `chroma_db\` | `<project>\backend\chroma_db\` |

`database\rag_knowledge.sql` stays where it is for now — step 3 uses it.

> These two folders hold the documents that were ingested during development
> and the vector embeddings built from them. Restoring them means the app
> opens with a populated knowledge base instead of an empty one.

---

## 3. Create and restore the database

Open PowerShell and run these, replacing the path to `psql.exe` if you
installed PostgreSQL somewhere else:

```powershell
$env:PGPASSWORD = 'rag'
$pg = 'C:\Program Files\PostgreSQL\16\bin'

# Create an empty database
& "$pg\createdb.exe" -U postgres -h localhost rag_knowledge

# Restore the dump from the CD (adjust the path to your CD drive)
& "$pg\psql.exe" -U postgres -h localhost -d rag_knowledge -f "D:\03-Application-Data\database\rag_knowledge.sql"
```

Confirm it worked — this should print a table count of 10 or more:

```powershell
& "$pg\psql.exe" -U postgres -h localhost -d rag_knowledge -c "\dt"
```

> If `createdb` reports that the database already exists, that is fine —
> skip straight to the restore command.

---

## 4. Create the environment file

The application reads its configuration from `backend\.env`, which is **not**
on the CD because it holds secrets. Create it from the template:

```powershell
cd <project>\backend
Copy-Item .env.example .env
notepad .env
```

Two values must be correct before the app will start:

```ini
POSTGRES_PASSWORD=rag          # the password you set in step 1
POSTGRES_DB=rag_knowledge
```

You also need a signing key for login sessions. Generate one and paste it in
as `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Everything else in the file has a working default. Leave `OPENAI_API_KEY`
empty unless you want to use cloud models — the application runs fully on
local models without it.

---

## 5. Create the Python environment

```powershell
cd <project>\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**This step downloads about 1.5 GB and takes 10–20 minutes.** An internet
connection is required. The large download is PyTorch, pulled in by
`sentence-transformers`, which generates the document embeddings locally.

> If `Activate.ps1` is blocked by a script-execution error, run:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and try again.

---

## 6. Install the frontend dependencies

```powershell
cd <project>\frontend
npm install
```

Takes 2–3 minutes and needs an internet connection.

---

## 7. Download a language model

```powershell
ollama pull llama3.2:3b
```

About 2 GB. This is the default model and it runs comfortably on a 4 GB
graphics card, or on the CPU if the machine has no dedicated GPU (slower,
but it works).

Optionally, for demonstrating the multi-model switching feature, pull one
or two more:

```powershell
ollama pull phi4-mini
ollama pull granite4:micro
```

Confirm what is installed:

```powershell
ollama list
```

> **Keep one tag per model family.** The model picker shows the first tag of
> each family, so pulling both `llama3.2:1b` and `llama3.2:3b` makes one of
> them unreachable from the interface.

---

## 8. Start the application

Setup is complete. From now on, this is the only step:

### Double-click **`start-app.bat`** in the project folder.

It starts PostgreSQL, Ollama, the backend and the frontend in the correct
order, waits for each one to answer, and opens the app in your browser at
**http://localhost:5173**.

Two console windows open, titled *RAG Backend* and *RAG Frontend*. **Leave
them open** while you use the application — closing one stops that server.

Sign in with the seeded administrator account:

```
Email    : admin@example.com
Password : admin1234
```

To shut down, double-click **`stop-app.bat`**, or simply close the two
console windows. PostgreSQL and Ollama are left running; they are shared
background services.

---

## 9. Verify the installation

Work through this list. If all five pass, the installation is correct.

1. **http://localhost:5173** loads the sign-in page.
2. Signing in as `admin@example.com` reaches the dashboard.
3. The sidebar lists documents and past conversations (restored in step 2).
4. **http://127.0.0.1:8000/docs** shows the FastAPI documentation page.
5. Starting a new chat and asking a question about an uploaded document
   returns an answer that reflects the document's contents.

Point 5 is the real test — it exercises the entire RAG pipeline: embedding
the question, searching the vector store, building the prompt, and running
the language model.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Browser shows "can't reach this page" | The frontend is not running | Check the *RAG Frontend* window for errors; re-run `start-app.bat` |
| Page loads but sign-in says "Login failed" | The backend is down, or another program holds port 8000 | See below |
| `start-app.bat` says PostgreSQL needs Administrator | The service is stopped | Right-click `start-app.bat` → **Run as administrator** |
| Backend window exits immediately | Wrong database password, or `rag_knowledge` doesn't exist | Recheck steps 3 and 4 |
| Chat spins forever, then errors | Ollama is not running, or no model is pulled | `ollama list`, then `ollama pull llama3.2:3b` |
| Answers are extremely slow | Model running on CPU, or too large for the GPU | Use `llama3.2:3b` or `granite4:micro` |
| `ModuleNotFoundError` in the backend window | Virtual environment not activated or incomplete | Redo step 5 |
| Sign-in works but no documents appear | Data from step 2 was not restored | Recopy `uploads\` and `chroma_db\` |

**Port 8000 held by another program.** The launcher detects this and refuses
to continue. To find and stop the offender:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess }
```

---

## 11. Running without Ollama (cloud models only)

If the machine cannot run a local model, the application also works with
OpenAI. Put a key in `backend\.env`:

```ini
OPENAI_API_KEY=your-key-here
DEFAULT_LLM_PROVIDER=openai
```

Restart the backend. The model picker will then offer `gpt-4o` under
**Cloud**. This needs an internet connection, and the local models section
will be empty.

Note that document **embeddings** still run locally via
`sentence-transformers` regardless of this setting, so ingestion works
offline either way.

---

## Appendix: starting the servers manually

`start-app.bat` automates the following. Run them in separate windows if you
prefer to see each step:

```powershell
# 1. PostgreSQL — a Windows service, normally already running
Start-Service postgresql-x64-16

# 2. Ollama
ollama serve

# 3. Backend
cd <project>\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 4. Frontend
cd <project>\frontend
npm run dev
```

Then open http://localhost:5173.
