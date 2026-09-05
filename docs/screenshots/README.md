# Screen Layouts / Screen Dumps

**RAG Powered Knowledge System** — IGNOU MCA, MCSP-232

Thirty-nine screens captured from the running application, numbered in the
order they are meant to appear in the project report. The order follows the
journey a user actually takes: arrive, sign in, ask a question, look at where
the answer came from, manage documents and projects, adjust the system, and
finally the administrator's view and the phone layout.

Desktop screens are 1440x900; phone screens are 414x896. The landing, features
and under-the-hood pages are full-page captures because they are meant to be
read whole; every other figure is a viewport capture, so the images sit at a
consistent size on the page.

Two accounts appear. `naval.chaudhary@example.com` is the ordinary user account
and provides every application screen. `admin@example.com` provides the two
administrator screens — that split is itself the evidence for the report's
*Creation of User Profiles and Access Rights* section.

The knowledge base is three policy documents (a hospital patient handbook, an
HR employee handbook and an IT security policy) holding 13 indexed chunks. The
answers shown are real answers from `llama3.2:3b` running locally, not mockups.

---

## 1. Public pages, signed out

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 1 | `01-landing.png` | Landing page with the product tour | Introduction |
| 2 | `02-landing-dark.png` | The landing page in dark theme | Introduction |
| 3 | `03-features.png` | Feature overview | Introduction |
| 4 | `04-under-the-hood.png` | Architecture explained to the end user | Introduction / System Design |
| 5 | `05-login.png` | Sign-in screen | User Interface Design |
| 6 | `06-register.png` | Account registration | User Interface Design |

## 2. Asking a question, and tracing the answer

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 7 | `07-new-chat.png` | A new conversation, with suggested prompts | User Interface Design |
| 8 | `08-answer-with-retrieval-line.png` | A grounded answer with its retrieval telemetry | System Design / Reports |
| 9 | `09-sources-expanded.png` | The five retrieved passages behind that answer | System Design / Reports |
| 10 | `10-source-passage.png` | One passage, with page, section, chunk and relevance | System Design / Reports |

## 3. Documents

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 11 | `11-document-library.png` | The document library | User Interface Design |
| 12 | `12-document-reader.png` | Reading view — the document rendered | User Interface Design |
| 13 | `13-document-source-view.png` | Source view — the extracted text itself | System Design / Testing |

## 4. Projects

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 14 | `14-projects.png` | Projects list | User Interface Design |
| 15 | `15-project-page.png` | A project with standing instructions and scoped context | Modularization |

## 5. Retrieval and model controls

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 16 | `16-model-picker.png` | Model selection — local models and cloud | System Design |
| 17 | `17-retrieval-scope.png` | Restricting retrieval to a single document | System Design |
| 18 | `18-add-menu.png` | Adding a document from the composer | User Interface Design |

## 6. Navigation and workspace

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 19 | `19-search-chats.png` | Searching conversations | User Interface Design |
| 20 | `20-sidebar-collapsed.png` | Sidebar collapsed to its rail | User Interface Design |
| 21 | `21-sidebar-groups-folded.png` | Sidebar with all three groups folded shut | User Interface Design |
| 22 | `22-account-menu.png` | Account menu — theme, language, settings | User Interface Design |
| 23 | `23-language-picker.png` | Interface language — eleven locales | User Interface Design |

## 7. Modes

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 24 | `24-private-chat.png` | Private chat — nothing is written to history | System Security |
| 25 | `25-dark-theme.png` | The same answer in dark theme | User Interface Design |

## 8. Settings

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 26 | `26-settings-general.png` | Settings — General | User Interface Design |
| 27 | `27-settings-account.png` | Settings — Account | System Security |
| 28 | `28-settings-privacy.png` | Settings — Privacy | System Security |
| 29 | `29-settings-usage.png` | Settings — Usage | Reports |
| 30 | `30-settings-knowledge.png` | Settings — Knowledge base | Reports |
| 31 | `31-settings-model.png` | Settings — Model and retrieval parameters | System Design |

## 9. Administration

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 32 | `32-admin-dashboard.png` | Administrator dashboard with live system health | Reports / Testing |
| 33 | `33-admin-users-and-logs.png` | User accounts and the query log | System Security / Reports |

## 10. Responsive — phone, 414x896

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 34 | `34-mobile-new-chat.png` | A new conversation on a phone | User Interface Design |
| 35 | `35-mobile-sidebar.png` | The navigation drawer open | User Interface Design |
| 36 | `36-mobile-answer.png` | A grounded answer on a phone | User Interface Design |
| 37 | `37-mobile-private-chat.png` | Private chat on a phone | System Security |
| 38 | `38-mobile-dark-answer.png` | The same answer, dark theme | User Interface Design |
| 39 | `39-mobile-dark-sidebar.png` | The drawer open, dark theme | User Interface Design |

---

## Notes for placing these in the report

**Figures 8, 9 and 10 are the three that matter most.** They are the visual
proof of retrieval-augmented generation actually working: the answer, the
passages it was built from, and the provenance of a single passage down to the
page number and relevance score. Give them a full-width placement and refer to
them from the System Design chapter.

**Figure 13 is more useful than it looks.** The reader has two views — Reading
renders the document, Source shows the characters the parser actually
extracted, with line numbers — and Source is the one that proves the ingestion
pipeline works: what is on screen there is exactly what got chunked and
embedded. Pair it with figure 12, the same document in Reading view, where the
report explains document processing.

**Figure 32 pairs with `docs/test-results.md`.** The dashboard reports queries
processed and a live health check across PostgreSQL, ChromaDB, Ollama, the
OpenAI API and the embedding model — evidence for the Testing chapter that does
not depend on the reader taking your word for it.

**Figures 16 and 17** together answer the synopsis requirement for multiple LLM
providers and for scoped retrieval, so cite them where those objectives are
addressed.

**Figures 20 and 21** are two different ways of getting the sidebar out of the
way: 20 collapses it to a rail entirely, 21 keeps it but folds Documents,
Projects and Chats shut. Keep whichever suits the point being made and drop the
other — two figures of an empty sidebar is one more than the report needs.

**Section 10 is the responsive set.** Between them these six show the phone
layout in both themes, the navigation drawer over the full screen, a real
answer with its retrieval line wrapped to two lines, and private mode. The
report only needs a few of them to make the point that the interface works on a
phone; pick the ones that carry your argument and leave the rest on the CD.
