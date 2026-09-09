# System Analysis

## Identification of Need

The need this system answers is not a shortage of documents. It is a shortage of *answers* from documents that already exist.

Consider the ordinary case. An organisation of two hundred people keeps an employee handbook of ninety pages, an IT security policy of forty, a leave policy, an expense policy, a code of conduct, and the minutes of every management meeting for three years. All of it is written down. All of it is available on a shared drive. And yet the question *"how many days of casual leave do I get, and do they carry over?"* is answered, in practice, by asking a colleague, because reading ninety pages to find one paragraph is not a reasonable thing to ask of somebody who has a question.

Three approaches are already available to that person, and each of them fails in a way worth naming precisely, because the failure defines what has to be built.

**Reading the document.** Reliable, and the answer is authoritative. It is also the most expensive option in the only currency that matters here, which is the reader's time. A ninety-page handbook read at a careful three minutes a page is four and a half hours. Nobody does this, which is why the question goes to a colleague instead.

**Searching for keywords.** Instant, and almost always wrong. Full-text search matches character sequences. The handbook says *"annual leave not availed within the calendar year shall lapse and shall not be carried forward"*; the question asked was *"can I roll over my holidays"*. There is not one word in common. The search returns nothing, or worse, returns three unrelated pages that happen to contain the word *leave* in the sense of departure. The user is handed a list of documents and is back where they started, except that they now also distrust the search box.

**Asking a general-purpose language model.** Fluent, immediate, well-organised and unverifiable. The model was trained on a large corpus of public text, and this organisation's handbook was not in it. Asked about casual leave entitlement, the model produces a confident paragraph describing what casual leave entitlement typically is, in a tone indistinguishable from the tone it would use if it did know. It cannot cite a source, because it does not have one. For a question that governs somebody's pay, their medication or their access rights, a plausible invention is a worse outcome than silence, because silence is visibly a non-answer and an invention is not.

The gap, then, is specific. What is needed is a system that reads the organisation's own documents, not a model's memory, answers in prose and not in a list of hits, matches on meaning rather than on characters, and shows its working so that the answer can be checked against the paragraph it came from. Retrieval-Augmented Generation is precisely the architecture that closes that gap, and this project builds a complete system on it.

Two further needs emerged during analysis and shaped the requirements as much as the primary one did.

The first is **confidentiality**. The documents that would most benefit from this treatment, the HR handbook, the clinical protocol, the security policy, are exactly the documents an organisation is least willing to send to a third-party API one query at a time. A system that can only work by posting the user's question and five paragraphs of their internal policy to a commercial endpoint is unusable in the settings where it is most wanted. Local inference therefore had to be a first-class option and not a degraded fallback, and this single requirement drove the choice of Ollama, of a local embedding model, and of an embedded vector store, not a hosted one.

The second is **auditability**. If the point of the system is that its answers are grounded, then the grounding must be visible. It is not sufficient for the design to be correct; the user must be able to see that a particular sentence came from page seven of a particular document, and to open that page. This turns what would otherwise be an internal implementation detail, which chunks were retrieved and what their similarity scores were, into part of the delivered interface.

## Preliminary Investigation

Before committing to the architecture, four kinds of feasibility were examined against the specific hardware and the specific twelve-week window available.

### Technical Feasibility

The question here is not whether retrieval-augmented generation can be built. It plainly can. The question is whether it can be built on one laptop, offline, by one person, in a semester.

Four technical risks were identified and each was settled by a trial before the corresponding module was written.

**Can a useful language model run locally on 4 GB of video memory?** This was the largest risk, because the entire confidentiality requirement rests on it. The approved proposal named `qwen3:8b`. A trial established that an 8-billion-parameter model quantised to roughly 4.9 GB does not fit in 4 GB of VRAM, spills into system memory, and takes minutes per answer. That is not a system anybody would use. `llama3.2:3b`, at about 2 GB, fits with room to spare and answers in one to three seconds on the same machine. The risk was real and the mitigation was to change the model, which is recorded in §1.4 as a departure from the proposal.

**Can embeddings be generated without a network?** `sentence-transformers/all-MiniLM-L6-v2` is 90 MB, downloads once, and runs on the CPU at a speed that makes a 90-page document a matter of seconds rather than minutes. It produces 384-dimensional vectors, which is small enough that a library of a few hundred documents occupies tens of megabytes rather than gigabytes. Feasible, and with the useful property that the same model embeds both documents and questions, which is what puts them in a comparable space at all.

**Is an embedded vector database sufficient?** ChromaDB in persistent mode requires no server process, no separate installation and no port. It stores its index on disk beside the application. For a single-machine deployment holding thousands rather than millions of chunks, an embedded store is the better choice, not a compromise, because it removes an entire class of deployment failure.

**Can the whole thing be installed on a machine with no internet connection?** This was verified as a distinct question, because several of the components would by default reach out to a model hub on first use. The answer is yes, provided the model files are present and the offline environment flags are set, and the mechanism is documented in Appendix A.

The conclusion of the technical investigation was that the system is feasible on the stated hardware, subject to using a 3-billion-parameter local model, not an 8-billion-parameter one.

### Economic Feasibility

The direct monetary cost of the delivered system is zero, and this is a deliberate property, not an accident of a student project.

Table: Cost of the delivered system

| Item | Licence | Cost |
|---|---|---|
| Python, FastAPI, SQLAlchemy, Uvicorn | Open source (BSD, MIT) | Nil |
| React, Vite, React Router, Axios | Open source (MIT) | Nil |
| PostgreSQL 16 | Open source (PostgreSQL licence) | Nil |
| ChromaDB, `chroma-hnswlib` | Open source (Apache 2.0) | Nil |
| Ollama and `llama3.2:3b` | Free to run locally | Nil |
| `all-MiniLM-L6-v2` embedding model | Apache 2.0 | Nil |
| RapidOCR, PyMuPDF, `pypdf`, `python-docx` | Open source | Nil |
| OpenAI `gpt-4o-mini` and embeddings | Commercial, metered | Optional; not required for any function |
| Hardware | Existing laptop | Nil (already owned) |

The only metered component in the entire system is the OpenAI provider, and it is optional in the strict sense: every function of the system, ingestion, embedding, retrieval, generation, citation, works with the cloud provider switched off and the network cable unplugged. An organisation adopting this system pays for a machine it already owns and nothing else. Where an organisation *does* want the higher answer quality of a large cloud model, it can select it per query, and the cost is then visible and attributable, because every query is logged with the provider and model that served it.

Against that, the cost of *not* having the system is the time already being spent. If twenty people each spend fifteen minutes a week hunting through policy documents, that is five hours a week, or roughly a quarter of a full-time post, spent on retrieval that a machine can do in four seconds.

### Operational Feasibility

Operational feasibility asks whether the people who would use the system can and will.

The interaction the system asks of an ordinary user is: sign in, drag a file onto a page, and type a question. That is not a new skill. The interface deliberately borrows the conversational layout that users have already learned elsewhere, so that the only genuinely novel element is the sources panel underneath each answer. And that element is optional to engage with, collapsed by default, and rewards the curious without obstructing anybody else.

The administrator's burden is likewise small: there is a dashboard that reports the state of the system and a user list. No routine administration is required, because there is no index to rebuild, no schedule to maintain and no external service to keep credentials for unless the cloud provider is deliberately enabled.

Two operational risks were identified and addressed in the design rather than left to documentation. The first is that a user uploads a scanned PDF, gets no error, and then finds that the system cannot answer anything about it. Which was in fact observed during testing, and led to OCR being added to the pipeline in spite of the proposal placing it out of scope. The second is that a user asks a question the documents do not cover, and receives an invented answer; the relevance floor described in §2.6.7 exists precisely so that this cannot happen silently.

### Schedule Feasibility

The available window ran from the approval of the synopsis to the date the bound report must be posted: 22 June to 15 September 2026, twelve weeks. The estimate developed in §2.3 gives an expected critical path of eighty-five days, which is what twelve weeks provides. The estimate was therefore feasible but not comfortable, and the schedule contains no slack on the critical path. A fact that made the two activities that *do* carry slack, authentication and the administrator's dashboard, the natural places to absorb any overrun.

## Project Planning and Scheduling

### Work Breakdown and Three-Point Estimation

The approved proposal sets out a twelve-week plan in eight phases: requirement analysis, system analysis and design, environment setup, backend development, frontend development, integration and testing, documentation, and submission. That outline is the schedule this project was approved against, and the network below is a refinement of it, not a replacement. The eight phases become twelve activities because two of them split along a real dependency: the proposal's single "Backend Development" phase is in practice four activities that must happen in order, since the retrieval engine cannot be built before there are embedded chunks to retrieve.

The work was therefore decomposed into twelve activities. Each was estimated using the three-point method, in which an optimistic time *o*, a most likely time *m* and a pessimistic time *p* are combined into an expected time:

> **tₑ = (o + 4m + p) / 6**

The weighting reflects the fact that the most likely estimate deserves more confidence than either extreme, while the extremes still pull the expected value in their direction. The estimates were made before the corresponding work began, and the values in the network below are the original ones, not values adjusted afterwards to match what happened.

The dependencies between the twelve activities are genuine, not merely conventional. The database schema cannot be written before the technology trial has settled what is being stored; the retrieval engine cannot be built before there are embedded chunks to retrieve; the chat interface cannot be finished before both retrieval and authentication exist, since it needs an answer to display and a user to attribute it to. Two activities, authentication and the administrator's dashboard, sit off the critical path and can be done at any point in a wide window, which is why they are drawn in green in both charts.

The expected duration along the critical path A → B → C → E → F → G → H → I → K → L is **eighty-five days**. Counted from 22 June 2026 that lands on 15 September 2026, which is the date the report has to be posted for it to arrive before the deadline. The plan and the deadline therefore agree, with no float in hand. Summing the variances along that chain gives Σσ² = 10.2, so the standard deviation of the whole project is about 3.2 days. That is the arithmetic behind §2.2.4 calling the schedule feasible but not comfortable: the expected finish is the posting date itself, so half the distribution of finishing dates lies beyond it. Figure 2.1 is the network.

### Function Point Analysis and Effort Estimation

The three-point estimate above sizes the *schedule*. It says nothing about how much function the system contains, and two projects with the same schedule can differ by an order of magnitude in what they deliver. Function point analysis measures the second thing, and it measures it from what the system does for its users rather than from how much code was written to do it, which is what makes it comparable across languages and across projects.

The count below is taken from the delivered system and not from the proposal. Every transaction in it is a route that exists in `app/api/` and is listed in Appendix C; every data function is a table in the schema of §2.7, the Chroma collection, or the settings file. Nothing is counted that was planned and not built.

**Data functions.** A logical file is a group of data the user recognises as one thing, which is not the same as a table. The three tables that hold a user, their reset codes and their sessions are one logical file with three record types, because a user does not think of a refresh token as a separate thing they own. The two external files are read and never written by this system.

Table: Data functions, with record and data element types

| Logical file | Type | RETs | DETs | Complexity | FP |
|---|---|---:|---:|---|---:|
| User account | ILF | 3 | 23 | Average | 10 |
| Document | ILF | 1 | 16 | Simple | 7 |
| Conversation | ILF | 2 | 16 | Simple | 7 |
| Project | ILF | 2 | 11 | Simple | 7 |
| Query log | ILF | 1 | 10 | Simple | 7 |
| Vector index | ILF | 1 | 9 | Simple | 7 |
| Runtime settings | ILF | 1 | 10 | Simple | 7 |
| Model registry | EIF | 1 | 4 | Simple | 5 |
| Cloud model catalogue | EIF | 1 | 4 | Simple | 5 |

Each of those is described in the sentence beside it here: **User account**, users, with password_reset_tokens and refresh_tokens as record types of the same logical file; **Document**, documents, together with the sealed file each row points at; **Conversation**, conversations and messages; **Project**, projects and project_documents.

**Transactional functions.** An external input maintains a logical file; an external output presents data that had to be derived or calculated; an external inquiry retrieves data and derives nothing. The distinction between the last two is where most of the judgement in this count lies, and it is made on whether the route computes anything. `GET /api/documents` returns rows and is an inquiry. `GET /api/admin/stats` computes counts across four tables and a mean response time, and is an output.

Table: Transactional functions, classified

| Function | Method | Type | Complexity | FP |
|---|---|---|---|---:|
| `/api/auth/register` | POST | EI | Average | 4 |
| `/api/auth/login` | POST | EI | Average | 4 |
| `/api/auth/refresh` | POST | EI | Average | 4 |
| `/api/auth/logout` | POST | EI | Simple | 3 |
| `/api/auth/forgot-password` | POST | EI | Simple | 3 |
| `/api/auth/reset-password` | POST | EI | Average | 4 |
| `/api/auth/me` | PATCH | EI | Average | 4 |
| `/api/auth/change-password` | POST | EI | Average | 4 |
| `/api/auth/account` | DELETE | EI | Complex | 6 |
| `/api/documents` | POST | EI | Complex | 6 |
| `/api/documents/{id}` | PATCH | EI | Simple | 3 |
| `/api/documents/{id}` | DELETE | EI | Average | 4 |
| `/api/chat` | POST | EI | Complex | 6 |
| `/api/chat/stream` | POST | EI | Complex | 6 |
| `/api/conversations/{id}` | PATCH | EI | Simple | 3 |
| `/api/conversations/{id}` | DELETE | EI | Simple | 3 |
| `/api/projects` | POST | EI | Average | 4 |
| `/api/projects/{id}` | PATCH | EI | Average | 4 |
| `/api/projects/{id}/open` | POST | EI | Simple | 3 |
| `/api/projects/{id}/documents` | PUT | EI | Average | 4 |
| `/api/projects/{id}` | DELETE | EI | Average | 4 |
| `/api/settings` | PATCH | EI | Average | 4 |
| `/api/admin/stats` | GET | EO | Complex | 7 |
| `/api/admin/system` | GET | EO | Average | 5 |
| `/api/usage` | GET | EO | Average | 5 |
| `/api/documents/{id}/content` | GET | EO | Complex | 7 |
| `/api/documents/{id}/thumbnail` | GET | EO | Average | 5 |
| `/api/documents/{id}/pages` | GET | EO | Simple | 4 |
| `/api/auth/me` | GET | EQ | Simple | 3 |
| `/api/models` | GET | EQ | Simple | 3 |
| `/api/settings` | GET | EQ | Simple | 3 |
| `/api/documents/{id}` | GET | EQ | Simple | 3 |
| `/api/documents/{id}/file` | GET | EQ | Simple | 3 |
| `/api/documents` | GET | EQ | Average | 4 |
| `/api/documents/{id}/chunks` | GET | EQ | Average | 4 |
| `/api/conversations` | GET | EQ | Average | 4 |
| `/api/conversations/{id}` | GET | EQ | Average | 4 |
| `/api/projects` | GET | EQ | Average | 4 |
| `/api/projects/{id}` | GET | EQ | Average | 4 |
| `/api/admin/users` | GET | EQ | Average | 4 |
| `/api/admin/query-logs` | GET | EQ | Average | 4 |

Four inputs are rated complex and it is worth saying why, because a complexity rating that cannot be defended is the usual way a function point count is inflated. Deleting an account cascades through six tables, the vector index and the file store. Uploading a document validates it, seals it, writes it and starts a separate process. The two chat routes each run a retrieval, a generation and four writes in one transaction. Nothing else in the system touches that many files at once.

**The unadjusted total.**

Table: Unadjusted function point count

| Function type | Simple | Average | Complex | Count | Unadjusted FP |
|---|---:|---:|---:|---:|---:|
| External input (EI) | 6 | 12 | 4 | 22 | 90 |
| External output (EO) | 1 | 3 | 2 | 6 | 33 |
| External inquiry (EQ) | 5 | 8 | 0 | 13 | 47 |
| Internal logical file (ILF) | 6 | 1 | 0 | 7 | 52 |
| External interface file (EIF) | 2 | 0 | 0 | 2 | 10 |
| **Total** | | | | **50** | **232** |

The unadjusted function point count is **232**.

**Adjusting for the fourteen general system characteristics.** Each is rated from 0, meaning no influence, to 5, meaning strong influence throughout. The ratings below are each tied to a fact about this system rather than to an impression of it.

Table: General system characteristics and their degrees of influence

| # | Characteristic | Rating | Why this rating |
|---:|---|---:|---|
| 1 | Data communications | 4 | A browser talks to an API over HTTP, or HTTPS in the networked deployment, and one route streams server-sent events. |
| 2 | Distributed data processing | 2 | Ingestion runs in a separate operating-system process from the API, so that a hung extraction cannot block it. It is not distributed across machines. |
| 3 | Performance | 4 | The proposal sets a five-second answer, and NFR-2 a tighter budget for retrieval alone. Performance decided the chunk size, the batch size and the existence of the streaming route. |
| 4 | Heavily used configuration | 2 | One machine, and a 4 GB graphics card that decided which model the system defaults to. |
| 5 | Transaction rate | 1 | A single organisation with no stated peak. Nothing in the design is sized for a transaction rate. |
| 6 | Online data entry | 5 | Every function is interactive. There is no batch entry anywhere in the system. |
| 7 | End-user efficiency | 5 | Eleven interface languages, a layout responsive to 414 px, live ingestion progress, a dark theme, drag-and-drop upload, and a retrieval line under every answer. |
| 8 | Online update | 4 | Documents, conversations, projects and settings are all maintained online, with recovery for documents left mid-processing by a restart. |
| 9 | Complex processing | 5 | Embedding, approximate nearest-neighbour search, an OCR fallback for pages with no text layer, a relevance floor that decides whether to generate at all, and an instruction hierarchy in the prompt. |
| 10 | Reusability | 3 | The provider factory and the embedding backend are each replaceable by adding one class. The code is layered for reuse but is not packaged as a library. |
| 11 | Installation ease | 4 | An installation guide written for a machine with none of the software on it, a disc build that fails if it finds a secret, a backup script and a Docker Compose deployment. |
| 12 | Operational ease | 3 | One double-click to start, automatic recovery of stuck documents, a health report and a schedulable backup. It is not unattended. |
| 13 | Multiple sites | 2 | Docker Compose and a TLS deployment make a second site installable. There is no multi-tenancy. |
| 14 | Facilitate change | 4 | Settings changeable at runtime, swappable providers, and a layered backend with no upward dependencies. |
| | **Total degree of influence** | **48** | |

The value adjustment factor is VAF = 0.65 + (0.01 x TDI) = 0.65 + (0.01 x 48) = **1.13**, and the adjusted count is AFP = UFP x VAF = 232 x 1.13 = **262.2 function points**, which rounds to **262**.

#### Effort, and How Far It Is From What Actually Happened

Turning a function point count into effort needs a productivity rate, and the rate is where the honesty of an estimate is won or lost: it is a single number that decides the answer, and it is always borrowed from projects that are not this one. Rather than pick one and present the result as a figure, three published rates are applied and the spread is shown.

Table: Effort implied by three productivity rates

| Productivity assumed | Implied effort | Implied duration for one developer |
|---|---:|---|
| 10 FP per person-month. Low, formal process with documented handovers | 26.2 person-months | about 524 working days |
| 15 FP per person-month. Typical for a new business application | 17.5 person-months | about 350 working days |
| 25 FP per person-month. High, a small team using modern frameworks | 10.5 person-months | about 210 working days |

The project actually ran to **85 days on the critical path**, which for a single developer is about **4.25 person-months**. The achieved rate is therefore 262 divided by 4.25, or about **62 function points per person-month**, between two and six times the published rates above.

A gap that size is worth explaining rather than explaining away, and there are four reasons for it that can be pointed at in this system.

**Most of the counted function is supplied, not written.** Function point analysis measures delivered function and is deliberately blind to how it arrives, which is its strength as a size measure and its weakness as an effort predictor. FastAPI supplies the routing, the request validation and the interactive API documentation; SQLAlchemy supplies persistence; Chroma supplies the index and its search; React supplies the rendering. Every one of those contributes function points that nobody in this project spent a day on.

**The published rates come from team projects.** They carry the cost of requirements passed between people, of integration between separately built parts, and of the communication overhead that grows with the square of the team. A single developer pays none of it.

**The complex-processing rating flatters the count.** A 5 on that characteristic is correct, because the retrieval pipeline genuinely is intricate. But the intricacy is mostly in composing two libraries and a language model correctly, not in writing novel algorithms, and the effort that a 5 implies did not have to be spent.

**The 85 days do not cover everything that exists.** They are the critical path of the plan in §2.3.1. This report, and the six operational features described in §6.8 and §6.4, were built after it. The honest comparison is therefore slightly worse for the project than the numbers above make it look.

One cross-check is worth recording. The delivered system is 24,522 lines of source, so the count works out at about **94 lines per function point**. Published gearing factors put Python at roughly 30 to 40 and JavaScript at roughly 45 to 55, which would predict somewhere near half of that. The difference is not a fault in the count: 18,514 of the 24,522 lines are the front end and the stylesheet, which deliver a great deal of interface across relatively few distinct transactions, and a stylesheet delivers no function points at all.

The conclusion to draw is not that the estimate was wrong but that function point analysis is a size measure being asked to do a second job. As a size measure it is sound: **262 adjusted function points** is a defensible statement about how much this system does, and it is comparable with any other system counted the same way. As an effort predictor it needed a productivity rate calibrated to a single developer working with modern frameworks, and no such rate was available in advance. It is available now, and it is about 62 function points per person-month.

### The Schedule

The Gantt chart places the same twelve activities on the calendar. Because the critical path has no slack, every critical activity starts on the day its predecessor ends, and the chart is consequently a staircase, not a set of overlapping bars. The two non-critical activities are drawn at their earliest start, with the float each carries shown as a dashed extension reaching the point where its successor begins. Figure 2.2 is the schedule.

<!-- landscape -->

![The PERT network. Boxes on the critical path are blue, the two that carry float are green, and the deliverable posted on 15 September is orange. Expected times are the tₑ values from the three-point estimates listed beneath the network, which also give each activity's variance.](assets/diagrams/plan-pert.png){width=9.4}

![The Gantt chart for the twelve activities. The dashed extension on D and J is the float each carries, running to the point where its successor begins; the dashed vertical line marks 15 September 2026, the date the bound report must be posted.](assets/diagrams/plan-gantt.png){width=9.4}

<!-- portrait -->

## The Software Engineering Paradigm Applied

The system was built to an **iterative and incremental** model, and the choice was made on the evidence of the technical investigation and not out of preference.

A strict waterfall was rejected for a concrete reason: two of its assumptions are false for this project. Waterfall assumes the requirements can be fixed before construction begins, and it assumes the technology behaves as documented. Neither held. The requirement for optical character recognition did not exist at the start. It was discovered by watching a scanned PDF ingest successfully and then answer nothing. And the local model named in the approved proposal did not fit the hardware, a fact that could only be found by running it. A process that forbids requirements from changing after the design phase would have produced a system that was faithful to a specification and useless in practice.

The pure prototyping model was rejected for the opposite reason. The deliverable is not a demonstration; it is a multi-user application with authentication, a relational schema, access control and a test report. A throwaway prototype produces none of those.

What was used instead is a sequence of increments, each of which is a working system that does less than the final one. Each increment carried a full pass of requirements, design, construction and test over one slice of function:

1. **Authentication and the shell.** Register, log in, a protected page. The smallest system that has a user in it.
2. **Documents.** Upload, store, list, delete. No intelligence at all; just a library that persists.
3. **The pipeline.** Extraction, chunking, embedding, indexing. At the end of this increment the documents were searchable but nothing asked them anything.
4. **Retrieval and generation.** The RAG engine, the prompt, the provider abstraction. This is the increment in which the system first answered a question.
5. **The conversational interface.** History, citations, the sources panel, the retrieval line.
6. **Refinement.** Projects, settings, the eleven interface languages, the administrator's dashboard, and the OCR pass that the third increment had shown to be necessary.

Each increment ended with the system in a runnable state, which had a practical benefit beyond process orthodoxy: a defect introduced in one increment was found while the increment that introduced it was still fresh. The list of defects in §5.6 is short for that reason, and every entry in it names the increment it belongs to.

The iterative model also explains a characteristic of this report that is worth stating plainly. Several design decisions described in Chapter 3 are recorded together with the alternative that was tried first and abandoned. A fixed progress table that froze the bar during OCR, a citation format that was removed and then restored, a second process opening the vector index while the first still held it. Those are not confessions padding out a chapter. They are the actual content of an iterative process, and a report that hid them would be describing a project that did not happen.

## Software Requirements Specification

### Purpose and Scope

This specification describes the functional and non-functional requirements of the RAG Powered Knowledge System. Its scope is the complete delivered application: the FastAPI backend, the React front end, the relational and vector stores, and the local and cloud model providers. It does not specify the internals of third-party components, Ollama, ChromaDB, PostgreSQL, beyond the behaviour this system depends on.

Requirements are identified as **FR-*n*** for functional and **NFR-*n*** for non-functional, and each is traceable: Chapter 5 names the test case that demonstrates it.

### Functional Requirements

The functional requirements are grouped by the module that satisfies them. The module structure itself is described in §3.1.

Table: Functional requirements, account and access

| Id | Requirement |
|---|---|
| FR-1 | A visitor shall be able to create an account with a unique username and a unique email address, and a password of at least eight characters. |
| FR-2 | The system shall store passwords only as bcrypt hashes, and shall never store, log or return a plaintext password. |
| FR-3 | A registered user shall be able to authenticate with email and password and receive a signed token carrying their identity and role. |
| FR-4 | Every request to a protected endpoint shall be rejected unless it carries a valid, unexpired token. |
| FR-5 | A user who has forgotten their password shall be able to obtain a single-use, time-limited reset code, and set a new password with it. |
| FR-6 | The system shall support exactly two roles, `user` and `admin`, and shall enforce the distinction on the server for every administrative endpoint. |
| FR-7 | A user shall be able to change their password, and to delete their own account together with all of their documents, conversations and vectors. |

Table: Functional requirements, the document library

| Id | Requirement |
|---|---|
| FR-8 | A user shall be able to upload a document in PDF, DOCX, TXT or MD format, up to the configured size limit. |
| FR-9 | The system shall reject any other file type, and shall say which types are accepted instead of failing generically. |
| FR-10 | Every uploaded document shall be extracted, split into overlapping chunks, embedded, and indexed into the vector store without further user action. |
| FR-11 | Where a PDF page carries no selectable text, the system shall render the page and recognise its text optically instead of indexing an empty document. |
| FR-12 | The system shall record and publish the live progress of ingestion, the stage, a percentage and a human-readable detail, so that the interface can show it. |
| FR-13 | Where ingestion fails, the system shall record the reason on the document and present it to the user instead of leaving the document in an indefinite processing state. |
| FR-14 | A user shall be able to list, open, read, rename, pin and delete their own documents, and shall not be able to see or act on any other user's. |
| FR-15 | Deleting a document shall remove its row, its stored file and all of its vectors. |

Table: Functional requirements, asking and answering

| Id | Requirement |
|---|---|
| FR-16 | A user shall be able to ask a question in natural language and receive an answer in prose. |
| FR-17 | The answer shall be generated only from passages retrieved from that user's own documents, and the prompt shall forbid the use of any other knowledge. |
| FR-18 | The system shall return, with every answer, the passages it used, each identified by document title, page number, section heading and relevance score. |
| FR-19 | Where no retrieved passage exceeds the relevance floor, the system shall say that it found nothing instead of generating an answer, and shall not call the language model at all. |
| FR-20 | The system shall retrieve the *k* nearest chunks by cosine similarity, with *k* configurable. |
| FR-21 | A user shall be able to restrict retrieval to a single document, or to the documents attached to a project. |
| FR-22 | A user shall be able to choose the provider and the model that answers each question, from those the server reports as available. |
| FR-23 | The system shall record, for every question, the response time, the number of chunks retrieved, the provider and the model. |
| FR-24 | A user shall be able to ask a question in a private mode in which no conversation, message or log row is written. |

Table: Functional requirements, conversations and projects

| Id | Requirement |
|---|---|
| FR-25 | Questions and answers shall be grouped into conversations, and a conversation shall be titled automatically from its first question. |
| FR-26 | A user shall be able to list, open, rename, pin, mark unread, search and delete their own conversations. |
| FR-27 | A reopened conversation shall show the sources and the retrieval details of every past answer, not only of answers received while the page was open. |
| FR-28 | A user shall be able to create a project, give it standing instructions, and attach a set of documents to it. |
| FR-29 | A conversation inside a project shall retrieve only from that project's documents, and where the project has none attached it shall say so instead of searching the whole library. |

Table: Functional requirements, administration

| Id | Requirement |
|---|---|
| FR-30 | An administrator shall be able to see counts of users, documents, conversations and queries, and the recent query log. |
| FR-31 | An administrator shall be able to see the live health of the system's dependencies, the database, the vector store and the model provider. |
| FR-32 | An administrator shall be able to list users with their role, status and activity. |
| FR-33 | No administrative endpoint shall be reachable by a user whose token carries the `user` role. |

### Non-Functional Requirements

The approved proposal states five non-functional requirements. All five appear below, and two of them, NFR-20 and NFR-21, are recorded as stated rather than demonstrated. The proposal's performance target is also worth stating precisely, because it has two halves: an answer in under five seconds, **and** a corpus of up to a thousand documents. The first half is met and measured. The second is not tested at all, and §5.7 says so.

Table: Non-functional requirements

| Id | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | A question shall be answered in **under five seconds**, which is the target the approved proposal sets. Measured mean over 31 cases on the local 3-billion-parameter model: 4162 ms, slowest 6389 ms (§5.5). |
| NFR-2 | Performance | Retrieval alone, embedding the question and searching the index, shall complete in under one second. |
| NFR-3 | Performance | Ingestion shall publish progress at least once per page or per batch, so that no phase appears frozen. |
| NFR-4 | Reliability | A failure in one document's ingestion shall not affect any other document or any other user. |
| NFR-5 | Reliability | The ingestion pipeline shall run in a separate operating-system process, so that a hung extraction cannot block the API. |
| NFR-6 | Security | All passwords shall be bcrypt-hashed; all tokens shall be signed; no secret shall appear in the source tree or the submitted media. |
| NFR-7 | Security | Every query touching user-owned data shall be filtered by the authenticated user's identity on the server, irrespective of what the client requests. |
| NFR-8 | Security | Vector search shall be filtered by user identity in the vector store itself, not merely after the results return. |
| NFR-9 | Security | Every uploaded document shall be encrypted before it is written to disk, so that reading the disk does not read the documents (§6.4). |
| NFR-10 | Security | Every route shall be rate limited per client address, with a stricter limit on the routes that accept a password (§6.8). |
| NFR-11 | Security | A session shall be revocable: signing out and changing a password shall stop working sessions on the server and not only in the browser (§6.2). |
| NFR-12 | Security | A deployment serving anyone but the host shall terminate TLS in front of the application, and shall publish no other port (§6.8). |
| NFR-13 | Privacy | The system shall be fully functional with no network connection, and shall not transmit document content anywhere unless the user selects a cloud provider. |
| NFR-14 | Usability | The interface shall be usable at 414 px width without horizontal scrolling. |
| NFR-15 | Usability | The interface shall be available in eleven languages, and switching language shall not require a reload or lose state. |
| NFR-16 | Usability | Every error shown to a user shall say what went wrong and what to do about it, in that user's language. |
| NFR-17 | Maintainability | The backend shall be organised into layers, routers, services, providers, models, with no upward dependencies. |
| NFR-18 | Maintainability | The language model provider and the embedding backend shall each be replaceable by adding one class and no other change. |
| NFR-19 | Portability | The system shall run on Windows and Linux, and shall have a Docker Compose configuration for deployment. |
| NFR-20 | Scalability | The proposal requires the architecture to support horizontal scaling of the vector database and the API servers. The delivered system is a single-machine deployment and this requirement is **stated but not demonstrated**; §5.7 says what was and was not measured, and §9.4 says what scaling would need. |
| NFR-21 | Availability | The proposal sets 99% uptime with error handling and logging. Error handling and logging are delivered and the administrator's health report (§7.7) reports live dependency status, but **no uptime figure is claimed**, because the system has not been run continuously long enough to measure one. |

### Assumptions, Dependencies and Constraints

The specification rests on four assumptions, each of which is a real limit on the delivered system and is stated here rather than discovered by the reader in Chapter 9.

- **Documents are in English.** The interface is available in eleven languages; the embedding model is English. A Hindi policy document will be ingested without error and will retrieve poorly.
- **Documents are textual.** Tables are extracted as text and lose their column structure. Diagrams and photographs are not interpreted; a scanned page of prose is recognised, a scanned flowchart is not.
- **One machine, one library per user.** The design assumes a deployment serving an organisation from a single host. There is no sharding, no replication and no cross-user document sharing.
- **The model provider is a dependency, not a component.** Ollama runs as a separate service. If it is not running, the system says so precisely, naming the provider and the failure, but it cannot answer.

## Data Flow Diagrams

### Notation

The diagrams in this section use the Yourdon-DeMarco convention throughout: a **circle** is a process that transforms data, a **rectangle** is an external entity outside the system's control, a pair of **open-ended parallel lines** is a data store, and an **arrow** is a flow of data labelled with what it carries. A **dashed arrow** is a flow that happens only under a stated condition. Processes are numbered so that process 3.1 is a component of process 3.0, and every flow crossing the boundary of an exploded process appears on both the parent and the child diagram.

**These diagrams were redrawn rather than reproduced from the approved synopsis, and it is worth saying exactly why.** The synopsis's own data flow diagrams have three problems, and none of them could be carried into a submitted report.

The first is a modelling error. The synopsis's context diagram places the **vector database outside the system, as an external entity**. It is not outside. ChromaDB is embedded, it is a directory on the same disk as the application, and the whole confidentiality argument in §2.1 rests on the system owning its own index. Drawn as an external entity it says the opposite of what the system does.

The second is a notation error. Every external entity in the synopsis is drawn as a **diamond**. A diamond is entity-relationship notation for a relationship. In data flow notation an external entity is a rectangle, and a diamond means nothing at all.

The third was practical, and it is the one objection that no longer applies. The synopsis diagrams carry their meaning in **colour**: green processes, yellow stores, blue entities. Printed in black and white those three would land as nearly the same grey, and a reader of the bound copy could not tell a process from a store. This report is printed in colour, so the figures here use the synopsis's own palette, sampled from its images rather than approximated: a pale blue on an ordinary shape, a pale green on whichever one the diagram is drawing attention to, a paler blue on a container, and a single mid blue outline on all of them. In the data flow diagrams the two main colours are used as the synopsis uses them, green for the system's own processes and blue for what lies outside it. What has not been given up is the geometry. Every distinction these diagrams draw is still carried by shape and by line weight as well as by hue, so a monochrome photocopy of this report stays readable, which a photocopy of the synopsis's diagrams would not.

To that must be added the plain fact that the synopsis diagrams describe a smaller system: five tables where the delivered schema has eight, and six processes where it has seven. A figure that contradicts the text beside it is worse than a figure the reader has not seen before.

What has been kept is the **numbering**, so that the two documents can be read side by side. Processes 1.0 to 6.0 carry the same numbers and the same responsibilities as in the synopsis; 7.0 is new, and covers the projects and settings that did not exist when the synopsis was written.

Table: The synopsis diagrams and the figures that replace them

| In the approved synopsis | In this report | What changed |
|---|---|---|
| DFD Level 0, context | Figure 2.3 | The vector store moved inside the system; entities became rectangles |
| DFD Level 1, one sheet, six processes | Figures 2.4, 2.5 and 2.6 | Split across three sheets so the flows can be followed; process 7.0 added |
| DFD Level 2, document pipeline | Figure 2.7 | Redrawn with the OCR branch, which did not exist in the synopsis |
| (none) | Figure 2.8 | Level 2 of the answering process, which the synopsis did not explode |
| ER diagram | Figure 2.9 | Eight entities instead of five; crow's foot notation with optional ends marked |
| Use case diagram | Figure 2.10 | Redrawn with `«include»` and `«extend»` and the administrator generalisation |
| Class diagram | Figure 2.11 | Redrawn as the code is actually written, with modules where there are modules |
| (none) | Figure 2.12 | Sequence diagram, which the synopsis did not have |
| Activity diagram | Figure 2.13 | Redrawn with two swimlanes and both failure exits |
| State diagram | Figure 2.14 | Five coarse states with the five fine stages as substates |
| System network architecture | Figure 3.5 | Redrawn as a UML deployment diagram |

### Context Diagram

The context diagram fixes the system's boundary. It has exactly one process, which is the system as a whole, and shows only what crosses that boundary.

Three external entities do. The **registered user** supplies documents, questions and preferences, and receives answers, sources and the document library. The **administrator** supplies nothing but requests and receives the operational picture. The **language model provider** is drawn as an external entity because it is genuinely outside the system's control: whether it is Ollama on the same machine or OpenAI across the internet, the system sends it a prompt and receives text, and cannot inspect or guarantee what happens in between. Figure 2.3 draws that boundary.

### Level 1, The Document Side

Level 1 was drawn as two sheets rather than one. A single sheet carrying all seven processes was attempted first and was unreadable: with seven processes and seven stores the flow lines crossed so often that no path could be followed. Splitting the level along its natural seam, what happens to documents, and what happens to questions, produced two diagrams each of which can be read, at the cost of showing the shared stores twice. Both sheets use the same process numbers and the same store identifiers, so the split is presentational and not a change to the model.

The first sheet covers getting a document into the system: process 1.0 authenticates the user against store D1, process 2.0 accepts and records the file into D3 and D2, and process 3.0 turns the stored file into indexed vectors in D4. Figure 2.4 is that sheet.

### Level 1, The Question Side

The second sheet covers asking. Process 4.0 is the retrieval-augmented generation engine and is drawn with a heavy outline because it is where the project's substance lies. Process 5.0 keeps conversations, and process 7.0 manages the projects and preferences that scope what 4.0 is allowed to search.

Two flows on this sheet repay attention. The dashed flow from D7 into 4.0 carries a project's standing instructions and the list of documents it is confined to; it is dashed because it exists only when the conversation belongs to a project. And the flow from 4.0 into D6 is the query log, which is written on every question whether the answer was good or not. That unconditional write is what makes the measurements in Chapter 5 possible. Figure 2.5 is the second sheet.

### Level 1, Sheet (c): Administration

The third sheet carries process 6.0 on its own, and it is the smallest of the three because the process is the simplest: it reads five stores and writes none of them.

That asymmetry is the point of drawing it. Every flow on the sheet points **into** 6.0. An administrator asks for the dashboard and receives counts, timings and the live health of each dependency, and nothing on the sheet gives 6.0 a way to change a row or to open a document. The access matrix in §6.3 states the same fact in words; here it is a property of the diagram, because a process with no outbound flow to a store cannot write to one.

Figure 2.6 is that sheet.

<!-- landscape -->

![Context diagram (DFD level 0). The system's boundary, and the three entities that cross it.](assets/diagrams/dfd-0-context.png){width=9.4}

![DFD level 1, sheet (a): authentication and the document pipeline.](assets/diagrams/dfd-1a-documents.png){width=9.4}

![DFD level 1, sheet (b): asking a question, and the stores that scope and record it.](assets/diagrams/dfd-1b-query.png){width=9.4}

![DFD level 1, sheet (c): administration. Every flow points into process 6.0, because it reads five stores and writes none.](assets/diagrams/dfd-1c-admin.png){width=7.4}

<!-- portrait -->

### Level 2, Process 3.0, Process Document

Exploding process 3.0 gives the five sub-processes of the ingestion pipeline. The sheet makes two things visible that the parent diagram cannot.

The first is that optical character recognition is a **conditional branch, not a stage**. Process 3.1 reads the file; if the pages yield selectable text it hands them straight to 3.3, and process 3.2 never runs. Only when a page has no text layer at all, which is what a scanner produces, does 3.1 hand the page images to 3.2. This matters because OCR is by far the most expensive part of the pipeline, and a design that ran it unconditionally would make every ordinary document slow to protect against an unusual one.

The second is that **every sub-process writes its own progress back to D2**. The stage name and the percentage on each of those flows are the actual values the pipeline reports. Drawing them individually and not as one summary flow is the honest depiction, because it is what makes the progress bar in the interface truthful: the bar advances because the process advanced, not because a timer said it should. Figure 2.7 is the exploded process.

### Level 2, Process 4.0, Answer Question

Exploding process 4.0 gives seven sub-processes, and the shape of the diagram is the argument of this project in one picture: **there are two ways out of this process that do not involve the language model at all.**

The first is process 4.2. Before anything is retrieved, 4.1 establishes whether retrieval is even the right response. Four situations short-circuit it: the question is a greeting, not a question; the user has uploaded no documents at all; the conversation belongs to a project with nothing attached to it; or the question is about the conversation itself rather than about the documents. Each of these is answered directly and plainly, with no sources, because there are none and pretending otherwise would be dishonest.

The second is the relevance gate at process 4.4. Retrieval always returns something, a nearest-neighbour search over a non-empty index cannot return nothing, so the mere existence of results proves nothing about whether they are relevant. Process 4.4 compares the best similarity score against a floor of 0.15. Below it, the system reports that it could not find anything and **the provider is never called**. This is the single most important control in the system, because it is the difference between a system that says "I don't know" and a system that invents. It also has a measurable side effect: because no model is invoked, the not-found reply is the fastest response the system produces.

Only on the path through 4.5 and 4.6 does a prompt reach the model, and by then the prompt contains the grounding rules, the numbered passages, the project's standing instructions and the recent history, everything the answer is permitted to draw on. Figure 2.8 is the exploded process.

<!-- landscape -->

![DFD level 2: process 3.0 exploded. The OCR branch runs only when a page has no text layer; each sub-process writes its own stage and percentage back onto the document row.](assets/diagrams/dfd-2a-ingest.png){width=9.4}

![DFD level 2: process 4.0 exploded. The two dashed flows are the paths on which the language model is never called at all.](assets/diagrams/dfd-2b-answer.png){width=9.4}

<!-- portrait -->

## Entity Relationship Model

The relational side of the system is nine entities. The diagram uses crow's-foot notation: a single perpendicular stroke is exactly one, a three-pronged foot is many, and an open circle is optional, zero or one.

Three relationships in the model are optional on the parent side, and each of those circles is a deliberate decision, not an oversight.

**A query log may outlive its user, and may outlive its conversation.** Both foreign keys on `query_logs` are nullable and both are declared `ON DELETE SET NULL`. If they were `CASCADE`, deleting a user would erase the performance record of every question they ever asked, and the administrator's figures would silently rewrite history every time somebody closed an account. The log is an operational record about the *system*, not personal data about the user, and it is designed to survive them.

**A conversation may outlive its project.** `conversations.project_id` is nullable, and a null there is meaningful and not merely absent: it denotes a loose chat that searches the whole library, which is how every conversation worked before projects existed. Deleting a project therefore sets its conversations free instead of deleting them, which is what a user expects when they tidy up a workspace.

Everything else cascades, and cascades deliberately. Deleting a user removes their documents, conversations, projects, reset tokens and refresh tokens. Deleting a conversation removes its messages. Deleting a document removes its project links. The rule the schema follows is that data belonging *to* a user goes when the user goes, and data *about* the system stays.

The one many-to-many relationship, a project holds many documents, and a document may sit in several projects, is resolved by the `project_documents` link table, whose primary key is the pair of foreign keys. This is what allows a document to be attached to three projects while remaining one file, one row and one set of vectors; attaching it to a project neither copies nor re-indexes anything.

<!-- landscape -->

![The entity relationship diagram. Underlined attributes are primary keys, italic ones are foreign keys, and an open circle marks the optional side of a relationship.](assets/diagrams/er-schema.png){width=8.0}

<!-- portrait -->

## Data Dictionary

The data dictionary records every attribute of every entity: its type, whether it may be null, its default, and what it means. The types are the PostgreSQL types actually created by the schema in §4.1, not approximations of them.

Table: Data dictionary, `users`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `user_id` | uuid | No | generated | Primary key. A UUID, not a serial, so that identifiers are not guessable and do not disclose how many users exist. |
| `username` | varchar(100) | No |, | Display name. Unique. |
| `email` | varchar(255) | No |, | Login identifier. Unique, indexed. |
| `password_hash` | varchar(255) | No |, | bcrypt hash. The plaintext is never stored, logged or returned. |
| `role` | varchar(20) | No | `user` | Either `user` or `admin`, enforced by a check constraint. |
| `is_active` | boolean | No | true | A disabled account authenticates no further requests. |
| `created_at` | timestamptz | No | now() | Registration time. |
| `last_login` | timestamptz | Yes |, | Updated on each successful authentication; drives the administrator's activity view. |
| `custom_instructions` | text | Yes |, | Standing instructions the user sets once. They ride above the grounding rules on every answer and cannot switch citation off. |
| `work_role` | varchar(40) | Yes |, | One of a fixed set of role identifiers, stored as the identifier and not the label so that it survives the interface being read in another language. |

Table: Data dictionary, `documents`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `document_id` | uuid | No | generated | Primary key. Also the key by which every chunk is tagged in the vector store. |
| `user_id` | uuid | No |, | Owner. `ON DELETE CASCADE`. Indexed. |
| `title` | varchar(255) | No |, | Display title, defaulted from the filename and renameable. |
| `original_filename` | varchar(255) | No |, | The name as uploaded, kept for download. |
| `file_path` | varchar(500) | No |, | Location of the stored file on disk. |
| `file_type` | varchar(10) | No |, | One of `pdf`, `docx`, `txt`, `md`, enforced by a check constraint. |
| `file_size` | bigint | No |, | Bytes. Constrained to be greater than zero. |
| `upload_date` | timestamptz | No | now() | Acceptance time, not completion time. |
| `processing_status` | varchar(20) | No | `pending` | The coarse, queryable state: `pending`, `processing`, `ocr`, `done`, `failed`. Indexed. |
| `chunk_count` | integer | No | 0 | Number of indexed chunks. Published as it grows, so the library shows it climbing. |
| `error_message` | text | Yes |, | Why ingestion failed, in words a user can act on. |
| `stage` | varchar(20) | Yes |, | The fine-grained stage within processing: `extracting`, `ocr`, `chunking`, `embedding`, `indexing`. |
| `progress` | integer | No | 0 | Overall percentage, 0, 100. Only ever moved forward, so a client may interpolate between polls. |
| `stage_detail` | varchar(120) | Yes |, | Human-readable detail, such as "OCR 4 of 11 page(s)". |
| `pinned` | boolean | No | false | Kept in the sidebar and not only on the library page. |

Table: Data dictionary, `conversations`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `conversation_id` | uuid | No | generated | Primary key. |
| `user_id` | uuid | No |, | Owner. `ON DELETE CASCADE`. Indexed. |
| `project_id` | uuid | Yes |, | The project that scopes this conversation. Null means the whole library. `ON DELETE SET NULL`. |
| `title` | varchar(255) | No | `New Chat` | Generated from the first question by the language model. |
| `pinned` | boolean | No | false | Pinned conversations sort above the rest. |
| `unread` | boolean | No | false | Set by hand from the conversation's menu and cleared when it is opened; nothing sets it automatically. |
| `created_at` | timestamptz | No | now() |, |
| `updated_at` | timestamptz | No | now() | Touched on every message. Indexed, because it is the sort order of the sidebar. |

Table: Data dictionary, `messages`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `message_id` | uuid | No | generated | Primary key. |
| `conversation_id` | uuid | No |, | Parent conversation. `ON DELETE CASCADE`. Indexed. |
| `role` | varchar(20) | No |, | Either `user` or `assistant`, enforced by a check constraint. |
| `content` | text | No |, | The question, or the generated answer. |
| `source_documents` | jsonb | Yes |, | The passages the answer used, and the retrieval metadata. Stored with the message and not only in the query log, so that a reopened conversation can show its sources. |
| `token_count` | integer | Yes |, | Reserved for token accounting. |
| `created_at` | timestamptz | No | now() | Message order within the conversation. |

Table: Data dictionary, `projects`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `project_id` | uuid | No | generated | Primary key. |
| `user_id` | uuid | No |, | Owner. `ON DELETE CASCADE`. Indexed. |
| `name` | varchar(120) | No |, | Display name. |
| `instructions` | text | Yes |, | Standing instructions applied to every conversation in the project. |
| `doc_scope` | varchar(10) | No | `selected` | `all` retrieves from the whole library; `selected` retrieves only from the attached documents. Check-constrained. |
| `pinned` | boolean | No | false | Kept in the sidebar. |
| `created_at` | timestamptz | No | now() |, |
| `updated_at` | timestamptz | No | now() |, |
| `last_opened_at` | timestamptz | Yes |, | When the project was last *opened*, which `updated_at` cannot answer: renaming and pinning deliberately restate `updated_at` so that they do not reorder the list. |

Table: Data dictionary, `project_documents`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `project_id` | uuid | No |, | Part of the composite primary key, and a foreign key to `projects`. `ON DELETE CASCADE`. |
| `document_id` | uuid | No |, | Part of the composite primary key, and a foreign key to `documents`. `ON DELETE CASCADE`. |

Table: Data dictionary, `query_logs`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `log_id` | uuid | No | generated | Primary key. |
| `user_id` | uuid | Yes |, | Who asked. `ON DELETE SET NULL`, so the operational record survives the account. |
| `conversation_id` | uuid | Yes |, | Which conversation. `ON DELETE SET NULL`, for the same reason. |
| `query_text` | text | No |, | The question as asked. |
| `response_time_ms` | integer | No |, | Whole round trip, measured in the engine. The basis of every timing in Chapter 5. |
| `chunks_retrieved` | integer | No | 0 | How many passages the answer was built from. Zero on a not-found reply. |
| `llm_provider` | varchar(50) | No |, | `ollama` or `openai`. |
| `model_name` | varchar(100) | No |, | The exact model that served the question. |
| `status` | varchar(20) | No | `success` | Outcome of the request. |
| `created_at` | timestamptz | No | now() | Indexed, because the dashboard reads this table in time order. |

Table: Data dictionary, `password_reset_tokens`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `token_id` | uuid | No | generated | Primary key. |
| `user_id` | uuid | No |, | Whose password may be reset. `ON DELETE CASCADE`. Indexed. |
| `code_hash` | varchar(255) | No |, | A hash of the reset code. The code itself is never stored, for the same reason a password is not. |
| `expires_at` | timestamptz | No |, | After this instant the code is refused. |
| `used` | boolean | No | false | Set on first use; a code works exactly once. |
| `created_at` | timestamptz | No | now() |, |

Table: Data dictionary, `refresh_tokens`

| Attribute | Type | Null | Default | Description |
|---|---|---|---|---|
| `token_id` | uuid | No | generated | Primary key. |
| `user_id` | uuid | No |, | Whose session this is. `ON DELETE CASCADE`. Indexed. |
| `token_hash` | varchar(64) | No |, | SHA-256 of the token. Unique and indexed: it is the only thing a renewal looks up. A hash rather than bcrypt because the token is 48 bytes the server generated, not a password a person chose, so there is no dictionary to slow an attacker down with. |
| `expires_at` | timestamptz | No |, | After this instant the session must sign in again. |
| `revoked` | boolean | No | false | Set by signing out, by a password change, and by spending the token in a renewal. |
| `replaced_by` | uuid | Yes | null | The token issued in exchange for this one. Its presence is what separates a token that was rotated from one that was merely withdrawn, and only the first is treated as evidence that a copy is in use. |
| `created_at` | timestamptz | No | now() |, |
| `last_used_at` | timestamptz | Yes | null | When this token was last exchanged. |

Two data structures used by the system are deliberately not in this dictionary, because they are not relational.

The first is the **vector store**. Each chunk in ChromaDB carries its embedding, its text, and a metadata record of `document_id`, `user_id`, `title`, `file_type`, `page_number`, `section` and `chunk_index`. That metadata is what allows a citation to name a page and a section, and what allows retrieval to be filtered by user and by document *inside the index* rather than after the results return. Its design is described in §3.3.

The second is the **JSON stored in `messages.source_documents`**, whose shape is given in §3.3.5.

## UML Models

### Use Case Model

The use case diagram separates what a user asks for from what the system then has to do. The distinction is carried by the `«include»` and `«extend»` relationships, and both are used with their proper meanings.

`«include»` marks a sub-behaviour that always happens. Uploading a document *always* extracts, splits and indexes it. There is no path through the upload use case that skips it. Asking a question *always* retrieves passages and *always* generates from them. Drawing these as included use cases and not as separate things the user does is what says that the user does not choose them; they are constituents.

`«extend»` marks a sub-behaviour that happens only under a condition, and it points from the extension to the base. Recognising text on a scanned page extends the extraction use case, and applies only when a page has no text layer. Answering without keeping the chat extends asking, and applies only when the user has turned private mode on.

The **administrator** is drawn as a generalisation of the registered user, with the hollow triangle pointing at the more general actor. This is not decoration: it is exactly what the `role` column means. An administrator is a registered user whose role reads `admin`, holds documents and conversations of their own like anybody else, and additionally reaches the administrative use case.

The **language model provider** appears as a supporting actor attached only to the generation use case, which records that the system depends on it for that one thing and for nothing else. The model is drawn in Figure 2.10.

### Class Model

The class diagram describes the software structure, and one thing about it has to be said plainly rather than dressed up: **most of the service layer of this system is written as modules of functions, not as classes.** The diagram therefore draws those as UML modules, a classifier carrying the `«module»` stereotype, and reserves the class notation for the two places where there genuinely is a class hierarchy. Inventing wrapper classes for the diagram that do not appear in the source would make the model prettier and the report false.

The two real hierarchies are the ones that exist because something has to be swapped at run time.

**`LLMProvider`** is an abstract class with two concrete subclasses, `OllamaProvider` and `OpenAIProvider`. Its abstract operation `chat_model()` is the whole contract, and `get_provider()` is the factory that resolves a provider name to an instance. This is the Strategy pattern, and it exists because the choice of model arrives with each request instead of being fixed at start-up: the same running server answers one question from a local model and the next from a cloud one.

**`Embeddings`** is an interface with two implementations, `LocalEmbeddings` over `all-MiniLM-L6-v2` and OpenAI's `OpenAIEmbeddings`. The `services.embeddings` module is the factory, and it caches its result, so the 90 MB model is loaded once per process rather than once per document.

The four layers are separated in the diagram by rules and not by frames, because a dependency that crosses a layer is the point of the drawing and a frame it has to be threaded around only obscures it. The dependencies all point downward, routers depend on services, services on providers, everything on persistence, and there are no upward dependencies at all, which is the property NFR-17 asks for. Figure 2.11 is the class model.

### Sequence Model

The sequence diagram traces one question from the keypress to the rendered answer. It is drawn for the non-streaming endpoint, because the streaming variant differs only in that the answer arrives in fragments; the order of the interactions is identical.

The `alt` fragment carries the analysis. Its two branches are the two outcomes of the relevance gate, and the upper branch, the one taken when the best passage scores below the floor, returns straight from `rag_engine` to the router without the `LLM provider` lifeline being activated at all. That absence is the point. It is also why the not-found answer is the fastest thing the system produces, which Chapter 5 measures rather than asserts.

Two further details are visible in the ordering. The user's message is written to the database **before** the engine is called, not after, so that a question survives a failure in generation. And the assistant's message is written together with its sources and its retrieval metadata in the same transaction as the query log row, which is what guarantees that a reopened conversation and the administrator's dashboard cannot disagree about what happened. Figure 2.12 traces the whole interaction.

<!-- landscape -->

![Use case diagram. Included use cases always run; extending use cases run only under the condition named. The administrator is a generalisation of the registered user, because that is what the role column says.](assets/diagrams/uml-use-case.png){width=7.6}

![Class diagram. The service layer is drawn as UML modules because that is how it is written; the two hierarchies are the two things that are swapped at run time.](assets/diagrams/uml-class.png){width=8.4}

![Sequence diagram: asking a question. On the upper branch of the alt fragment the language model is never activated.](assets/diagrams/uml-sequence-ask.png){width=8.6}

<!-- portrait -->

### Activity Model

The activity diagram covers ingestion, and it is drawn with two swimlanes because the interesting property of that process is that two things run at once. The API answers 201 and spawns the pipeline as a **separate operating-system process**; the browser then polls the document row once a second and draws the bar from the `stage` and `progress` columns the worker is writing. Neither waits for the other.

Running the pipeline as its own process and not as a background task in the web server is a decision with a reason behind it, recorded in §3.2.2: a synchronous extraction running in the server's thread pool can deadlock the worker thread and leave uploads stuck on "processing" for ever. Process isolation makes that failure impossible rather than unlikely.

Both failure exits are drawn. A file of the wrong type or size never reaches the pipeline at all and is refused with a reason. A PDF that yields no text even after optical character recognition ends at the second final node with its reason written on the row. Which is a state a real user can reach, by uploading a blank scan, and which they should be told about rather than left watching a bar that has stopped.

![Activity diagram: uploading and indexing a document. The browser polls while a separate process does the work, and both ways of failing are drawn.](assets/diagrams/uml-activity-ingest.png){width=6.0}

<!-- pagebreak -->

### State Model

The state diagram is the life of a single document. Its five outer states are the five values `processing_status` may hold, and the five states inside the composite are the values of `stage`.

Two columns rather than one is itself the design decision this diagram documents. `processing_status` is the coarse column: it takes five values, it is indexed, and it is what a query filters on when the library page asks for every document that is still processing. `stage` is the fine column: it names which of the five phases the worker is inside, and it is what drives the progress bar. Collapsing them into one would force a choice between a column with too many values to index usefully and a bar with too few steps to be informative.

The percentages on the substates are the actual figures the pipeline reports, and the way they are allocated is deliberate. Each stage is given the span from wherever the previous stage finished up to its own end, not a fixed slice from a table. That is what keeps the bar continuous whether or not optical character recognition runs: a scanned PDF finishes reading at 35 % and OCR then owns 35 → 60 %, while a document with a text layer simply lets chunking take that room instead.

<!-- landscape -->

![State diagram: the life of a document. The outer states are `processing_status`; the substates are `stage`, and the percentages are the ones the pipeline actually reports.](assets/diagrams/uml-state-document.png){width=9.4}

<!-- portrait -->

## What the Analysis Settled

Four things were fixed by the analysis in this chapter, and the design in Chapter 3 is constrained by all four.

**The boundary.** The system owns its documents, its vectors, its conversations and its logs. It does not own the language model. Everything that follows from that, the provider abstraction, the health check before retrieval, the precise error message naming which provider failed, is a consequence of drawing the boundary where the context diagram draws it.

**The grounding rule, and its enforcement point.** The requirement that answers come only from retrieved passages is not a matter of prompt wording alone. It is enforced at process 4.4, before generation, by a numerical floor on the best similarity score. A prompt can be ignored by a model; a call that is never made cannot be.

**The ownership rule.** Every entity that belongs to a user carries a `user_id`, every query is filtered by it on the server, and the vector search is filtered by it inside the index. The entity model and the security measures in Chapter 6 are two views of the same decision.

**What is recorded, and what survives.** The query log outlives the user and the conversation on purpose, the message keeps its own sources so that history is self-contained, and the document row carries both a coarse state and a fine one so that the interface can be honest about progress. Every measurement in Chapter 5 is possible because of a column specified here.
