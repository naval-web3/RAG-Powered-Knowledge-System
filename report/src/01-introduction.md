<!-- numbered -->

# Introduction and Objectives

## Introduction

Every organisation of any size holds most of what it knows in prose. Policy manuals, employee handbooks, standard operating procedures, clinical guidelines, audit reports, meeting minutes, research papers and technical documentation accumulate year after year, and they are the record of how that organisation actually works. They are also, in practice, close to unreadable at the moment a question is asked. A nurse who needs to know how long a patient's records must be retained, an employee who wants to know how many days of leave carry over, an engineer checking whether a password policy permits a twelve-character passphrase — each of them needs one paragraph out of some hundreds of pages, and each of them has to find it.

The two tools normally reached for both fail, and they fail in different ways.

The first is keyword search. Full-text search matches strings, not meaning. A document that says *"annual leave not availed in a calendar year shall be carried forward"* does not contain the words the user typed, which were *"can I roll over my holidays"*, and so it is not returned; meanwhile a page that happens to use the word *leave* in the sense of *leave the premises* is. The user is left to read the results and decide which, if any, answer the question — which is the work they were trying to avoid.

The second is a large language model. Asked the same question in plain English, a model such as GPT-4 or Llama produces a fluent, well-organised, confident answer. The difficulty is that the answer is generated from patterns learned during training, and the organisation's handbook was not in the training data. Where the model does not know, it does not stop; it produces something plausible. It cannot cite a source, because it has none, and the user has no way to tell a correct answer from an invented one. For a question about a policy that governs pay, medication or security, a plausible invention is worse than no answer at all.

Retrieval-Augmented Generation, described by Lewis and colleagues in 2020, resolves this by refusing to let the model answer from memory. The question is first used to *retrieve* the passages of the organisation's own documents that are semantically closest to it; those passages are then placed in front of the language model as the only material it is permitted to use. The model's contribution is reduced to what it is genuinely good at — reading several passages of prose and composing a direct, well-formed answer — while the facts come from documents the organisation wrote and can verify. Because the retrieved passages are known, every answer can carry its sources, and the user can open the exact paragraph that produced any sentence in it.

This project designs, builds, tests and documents a complete working system on that architecture. It is not a demonstration of a pipeline in a notebook. It is a multi-user web application with accounts and roles, a document library with a real ingestion pipeline, a conversational interface, a vector store, a relational database, an administrator's view of the running system, and an installation procedure that brings all of it up on a machine with no internet connection.

![The landing page. The system is presented to a first-time visitor by what it does — a question answered from the user's own documents, with the sources it used.](../docs/screenshots/01-landing.png){width=5.9}

## The Problem This Project Addresses

The problem can be stated precisely, because a precise statement is what makes it testable.

**Given** a collection of an organisation's own documents in ordinary office formats, and **given** a question asked in natural language by an authorised user, **produce** an answer that is (a) composed in fluent prose rather than returned as a list of documents to read, (b) derived only from those documents and not from a language model's training data, (c) accompanied by the specific passages it was derived from, identified down to the page and section, and (d) returned quickly enough to be used conversationally.

Four constraints follow from that statement, and they shaped the whole design:

- **Retrieval must work on meaning, not words.** This rules out full-text search and requires dense vector embeddings with a similarity measure over them.
- **Generation must be grounded and must refuse.** A system that answers anyway when the documents do not contain the answer is worse than useless, because its failures are invisible. The system must be able to say that it does not know.
- **Attribution must be part of the answer, not an afterthought.** Every retrieved passage must carry enough metadata — document, page, section — to be shown to the user and opened.
- **The organisation's documents must not have to leave the building.** A knowledge system holding an HR handbook or patient policies cannot be built on the assumption that every query may be sent to a third-party API. Local inference must be a first-class option, not a fallback.

## Objectives of the Project

The objectives below are those set out in the approved project proposal, unchanged. Each is restated here with the part of the delivered system that satisfies it and the chapter of this report where the evidence is presented.

1. To design and develop a full-stack web application that enables intelligent document-based question answering using Retrieval-Augmented Generation.
2. To implement a document ingestion pipeline supporting multiple file formats (PDF, DOCX, TXT) with automatic text extraction, chunking and preprocessing.
3. To generate vector embeddings of document chunks using pre-trained transformer models and store them in the ChromaDB vector database.
4. To build a semantic search engine that retrieves the most contextually relevant document chunks for a user query using cosine similarity.
5. To integrate large language models via the LangChain framework for generating accurate, context-grounded natural language responses from the retrieved chunks.
6. To develop an interactive and responsive user interface using React with real-time chat, document upload and conversation history management.
7. To implement robust user authentication, role-based access control and document-level security mechanisms.
8. To apply software engineering best practice including a defined SDLC methodology, modular architecture, comprehensive testing and thorough documentation.
9. To evaluate the system's performance in terms of retrieval accuracy, response quality and latency.

Table: How each objective is met, and where in this report the evidence appears

| Objective | Delivered as | Evidence |
|---|---|---|
| 1. Full-stack RAG application | React 18 single-page interface, FastAPI REST backend, PostgreSQL and ChromaDB | Chapter 3, §3.7 |
| 2. Ingestion pipeline | `document_processor.py` — format-specific extraction, OCR fallback, recursive splitting at 1000 characters with 200 of overlap | Chapter 3, §3.2.3 |
| 3. Embeddings in ChromaDB | `all-MiniLM-L6-v2` locally (384 dimensions) or OpenAI `text-embedding-3-small`, persisted in ChromaDB with page and section metadata | Chapter 3, §3.3.6 |
| 4. Semantic search | Cosine similarity over the vector store, top-*k* configurable per user, scoped by document or project | Chapter 3, §3.2.4 |
| 5. Grounded generation | `rag_engine.py` — a prompt that supplies numbered passages and forbids outside knowledge, over Ollama or OpenAI | Chapter 3, §3.4.2 |
| 6. Interactive interface | 11 pages and 22 components, conversation history, streaming-style response handling, responsive to 414 px | Chapter 3, §3.6 and Chapter 8 |
| 7. Authentication and access control | JWT with bcrypt hashing, two roles, per-user ownership enforced in every query | Chapter 6 |
| 8. Engineering practice | Iterative SDLC, seven modules, 31 system test cases, this report | Chapters 2, 4 and 5 |
| 9. Performance evaluation | 31 documented test cases; mean response 4.2 s on a local 3-billion-parameter model | Chapter 5, §5.5 |

## Project Category

The project belongs to more than one of the categories listed in the MCSP-232 guidelines, and it is worth saying which parts fall where rather than simply naming them all:

- **Artificial Intelligence and Machine Learning** — the core of the system is a retrieval-augmented generation pipeline built on a pre-trained transformer embedding model and a large language model.
- **Natural Language Processing** — questions and documents are both handled as natural language; chunking, embedding, semantic matching and prompt construction are all NLP tasks.
- **Data Science** — the retrieval step is a nearest-neighbour search in a 384-dimensional vector space, and the evaluation in Chapter 5 measures its behaviour empirically.
- **Web Application Development (full-stack)** — the delivered artefact is a multi-user web application with an API, a single-page front end and session management.
- **Database Management Systems** — the system uses two stores of different kinds: PostgreSQL for normalised relational data and ChromaDB as a vector store, each chosen for what it is good at.

## Tools, Platform and Environment

The system was developed and is documented against the environment in Table 1.2. Version numbers are the exact pins in `backend/requirements.txt` and `frontend/package.json`, not approximations, because several of them were chosen deliberately and the reasons are recorded in Chapter 4.

Table: Software environment

| Component | Technology and version |
|---|---|
| Operating system (development) | Windows 11 Home Single Language 26200 |
| Language — backend | Python 3.12 |
| Language — frontend | JavaScript (ES2022), JSX |
| Backend framework | FastAPI 0.115.6 on Uvicorn 0.34.0 (ASGI) |
| Frontend framework | React 18.3.1, React Router 6.28, built by Vite 6.0.7 |
| HTTP client | Axios 1.7.9 with request and response interceptors |
| LLM orchestration | LangChain 0.3.14 (`langchain-ollama`, `langchain-openai`) |
| LLM provider — local | Ollama 0.5, serving `llama3.2:3b` and `granite4:micro` |
| LLM provider — cloud | OpenAI `gpt-4o` and `gpt-4o-mini` |
| Embedding model — local | `sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions |
| Embedding model — cloud | OpenAI `text-embedding-3-small`, 1536 dimensions |
| Vector database | ChromaDB 0.5.4 with `chroma-hnswlib` 0.7.5, persisted to disk |
| Relational database | PostgreSQL 16 accessed through SQLAlchemy 2.0.37 |
| Document parsing | `pypdf` 5.1.0, `python-docx` 1.1.2 |
| OCR (scanned PDFs) | PyMuPDF 1.28 for rendering, RapidOCR-ONNXRuntime 1.4.4 for recognition |
| Authentication | `python-jose` (JWT, HS256), `passlib` with bcrypt 4.2.1 |
| Testing | pytest 8.3.4, httpx 0.28.1, Playwright 1.61 for interface capture |
| Version control | Git, with the repository hosted privately on GitHub |
| Editor | Visual Studio Code |

Table: Hardware used for development and demonstration

| Component | Specification |
|---|---|
| Processor | AMD Ryzen 5, 6 cores |
| Memory | 16 GB DDR4 |
| Graphics | NVIDIA GeForce RTX 3050 Laptop GPU, 4 GB VRAM |
| Storage | 512 GB NVMe SSD (the vector store, uploads and database together occupy about 120 MB) |
| Display | 1920 × 1080 |
| Network | Required only when the OpenAI provider is selected; the system is fully functional offline |

Two entries in that table differ from the approved proposal and the difference is deliberate. The proposal named **qwen3:8b** as the local model; a 4.9 GB model does not fit in 4 GB of video memory, spills to the CPU and takes minutes per answer, so the system ships with **llama3.2:3b**, which answers in one to three seconds on the same machine. The proposal also named **Tailwind CSS**; Tailwind remains in the build configuration from the initial scaffold, but the delivered interface is styled by a single hand-written stylesheet of 3,581 lines. The reasoning is given in §3.6.

## Scope of the Solution

### In scope, and delivered

The following were promised in the approved proposal and are present in the submitted system:

- Document ingestion for PDF, DOCX and TXT, with automatic text extraction, cleaning and chunking.
- Vector embedding generation, locally or through OpenAI, and persistence in ChromaDB.
- Semantic retrieval by cosine similarity with a configurable *k*.
- Grounded answer generation through LangChain with source citation.
- An interactive React chat interface with conversation history.
- JWT authentication and role-based authorisation.
- An administrator dashboard with system analytics and user management.
- Support for both cloud (OpenAI) and local (Ollama) language models, switchable per query.
- Conversation storage, retrieval, renaming, pinning and deletion.
- A Docker Compose deployment configuration.

### Delivered beyond the approved scope

Four capabilities in the submitted system were not part of the approved proposal. They are listed separately here rather than folded silently into the list above, because the proposal is the contract this project was approved against and the difference should be visible to the examiner.

- **Optical character recognition for scanned PDFs.** The proposal explicitly placed OCR *out* of scope. During testing it became clear that a PDF produced by a scanner — which is what a great many real policy documents are — was accepted, produced zero chunks and then answered nothing, silently. Rather than reject such files, the pipeline now detects a page with no embedded text, renders it at 240 dpi and recognises the text with RapidOCR. This is described in §3.2.3 and tested in §5.4.
- **Project workspaces.** A project holds standing instructions and a chosen set of documents, and a conversation inside it retrieves only from those documents. This addresses a limitation found in use: a single flat library means a question about the IT policy can be answered from the HR handbook if a passage happens to be similar.
- **An interface in eleven languages.** The proposal placed multi-language support out of scope, and *document* content remains English. What was added is the *interface*: 355 strings per locale across eleven languages. The distinction is made carefully in §3.6.5.
- **A private conversation mode** in which nothing is written to the conversation history, described in §6.6.

### Out of scope

The following remain out of scope, as approved:

- Real-time collaborative document editing.
- Audio and video documents (speech-to-text).
- Retrieval over documents written in languages other than English.
- Native mobile applications; the web interface is responsive instead.
- Fine-tuning or custom training of language models.

## An Overview of the Delivered System

A short walk through one question shows how the parts fit together, and the rest of the report expands each step.

A user signs in and uploads an employee handbook. The upload is accepted, stored, and a background worker begins processing it: the text is extracted page by page, section headings are detected and remembered, the text is split into overlapping chunks of about a thousand characters, each chunk is converted into a 384-dimensional vector, and the vectors are written to ChromaDB along with the document, page and section each came from. The user watches this progress in the library, stage by stage.

The user then asks: *"How many days of casual leave am I entitled to?"* The question is embedded by the same model that embedded the documents, so that question and passages live in the same vector space. ChromaDB returns the five nearest chunks by cosine distance. Those five passages are numbered and placed into a prompt that instructs the model to answer only from them and to cite them; the prompt goes to `llama3.2:3b` running locally through Ollama. The answer comes back in about four seconds, is shown with a line stating how many passages were retrieved, from which documents, in how many milliseconds, and can be expanded to show all five passages. Clicking one opens the passage itself with its page, its section and its relevance score.

![A grounded answer. Under it, the retrieval line records how many passages were used, from which document, and how long the whole round trip took.](../docs/screenshots/08-answer-with-retrieval-line.png){width=5.9}

Everything that happened is recorded: the message and its sources in PostgreSQL, and a row in the query log holding the response time, the number of chunks retrieved, the provider and the model. That log is what the administrator's dashboard reports on, and what Chapter 5 measures.

![The architecture as it is explained to the end user, on the application's own "under the hood" page.](../docs/screenshots/04-under-the-hood.png){width=5.5}

## Organisation of This Report

**Chapter 2, System Analysis**, establishes the need the system answers, the feasibility of building it, the estimation and schedule it was built to, and the formal analysis models: the software requirements specification, the data flow diagrams at three levels, the entity-relationship model with cardinality, the data dictionary and the UML models.

**Chapter 3, System Design**, turns that analysis into a design: the seven modules and their responsibilities, the relational schema normalised to third normal form with its integrity constraints, the design of the vector store, the procedural design of the ingestion and retrieval algorithms, the interface design, and the deployment architecture.

**Chapter 4, Coding**, presents the implementation: the SQL that creates the schema and grants access, the coding standards followed, annotated segments of the code that carries the system's logic, and the approaches taken to error handling, parameter passing and validation.

**Chapter 5, Testing**, gives the testing strategy, the unit test cases and their results, the thirty-one system test cases run against a purpose-built corpus, the performance measurements, and an account of the defects found and what was done about them — including one that is still open and is described as such.

**Chapter 6, System Security Measures**, covers authentication, the role model and access rights, data and database security, input validation, and the measures taken to keep secrets out of the submitted media.

**Chapter 7, Reports and Outputs**, shows the sample layouts of every report the system produces.

**Chapter 8, Screen Layouts**, presents the remaining interface screens in the order a user meets them.

**Chapter 9** sets out the future scope, **Chapter 10** concludes, and the appendices hold the installation guide, the user manual, the REST API reference and the glossary.
