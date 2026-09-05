# Screen Layouts / Screen Dumps

**RAG Powered Knowledge System** — IGNOU MCA, MCSP-232

Thirty-two screens captured from the running application, in the order they are
meant to appear in the project report. All were taken at 1440×900 in Chromium.
The three marketing pages are full-page captures; everything else is a viewport
capture, so the figures stay a consistent size on the page.

Two accounts appear. `naval.chaudhary@example.com` is the ordinary user account
and provides every application screen. `admin@example.com` provides the two
administrator screens — that split is itself the evidence for the report's
*Creation of User Profiles and Access Rights* section.

The knowledge base is three policy documents (a hospital patient handbook, an
HR employee handbook and an IT security policy) holding 13 indexed chunks. The
answers shown are real answers from `llama3.2:3b` running locally, not mockups.

## Figure index

| # | File | Suggested caption | Report chapter |
|---|---|---|---|
| 1 | `01-landing.png` | Landing page with the product tour | Introduction |
| 2 | `02-features.png` | Feature overview page | Introduction |
| 3 | `03-under-the-hood.png` | Architecture explained to the end user | Introduction / System Design |
| 4 | `04-login.png` | Sign-in screen | User Interface Design |
| 5 | `05-register.png` | Account registration | User Interface Design |
| 6 | `06-new-chat.png` | New conversation, with suggested prompts | User Interface Design |
| 7 | `07-answer-with-retrieval-line.png` | A grounded answer with its retrieval telemetry | System Design / Reports |
| 8 | `08-sources-expanded.png` | The five retrieved passages behind the answer | System Design / Reports |
| 9 | `09-source-passage.png` | One source passage, with page, section and relevance | System Design / Reports |
| 10 | `10-document-library.png` | Document library | User Interface Design |
| 11 | `11-document-reader.png` | Full-window document reader | User Interface Design |
| 12 | `12-projects.png` | Projects list | User Interface Design |
| 13 | `13-project-page.png` | A project with standing instructions and scoped context | Modularization |
| 14 | `14-model-picker.png` | Model selection — local models and cloud | System Design |
| 15 | `15-retrieval-scope.png` | Restricting retrieval to one document | System Design |
| 16 | `16-add-menu.png` | Adding a document from the composer | User Interface Design |
| 17 | `17-private-chat.png` | Private chat — nothing is written to history | System Security |
| 18 | `18-settings-general.png` | Settings — General | User Interface Design |
| 19 | `19-settings-account.png` | Settings — Account | System Security |
| 20 | `20-settings-privacy.png` | Settings — Privacy | System Security |
| 21 | `21-settings-usage.png` | Settings — Usage | Reports |
| 22 | `22-settings-knowledge.png` | Settings — Knowledge base | Reports |
| 23 | `23-settings-model.png` | Settings — Model and retrieval parameters | System Design |
| 24 | `24-account-menu.png` | Account menu — theme, language, settings | User Interface Design |
| 25 | `25-language-picker.png` | Interface language — eleven locales | User Interface Design |
| 26 | `26-admin-dashboard.png` | Administrator dashboard with live system health | Reports / Testing |
| 27 | `27-admin-users-and-logs.png` | User accounts and the query log | System Security / Reports |
| 28 | `28-mobile-chat.png` | Responsive layout at 414×896 | User Interface Design |
| 29 | `29-search-chats.png` | Searching conversations | User Interface Design |
| 30 | `30-dark-theme.png` | The same answer in dark theme | User Interface Design |
| 31 | `31-sidebar-collapsed.png` | Sidebar collapsed to its rail | User Interface Design |
| 32 | `32-sidebar-groups-folded.png` | Sidebar with all three groups folded shut | User Interface Design |

## Notes for placing these in the report

Figures 7, 8 and 9 are the three that matter most. They are the visual proof of
retrieval-augmented generation actually working: the answer, the passages it was
built from, and the provenance of a single passage down to the page number and
relevance score. Give them a full-width placement and refer to them from the
System Design chapter.

Figure 26 pairs well with `docs/test-results.md`. The dashboard reports 229
queries processed and a live health check across PostgreSQL, ChromaDB, Ollama,
the OpenAI API and the embedding model — evidence for the Testing chapter that
does not depend on the reader taking your word for it.

Figures 14 and 15 together answer the synopsis requirement for multiple LLM
providers and for scoped retrieval, so cite them where those objectives are
addressed.

Figures 31 and 32 are two different ways of getting the sidebar out of the way:
31 collapses it to a rail entirely, 32 keeps it but folds Documents, Projects
and Chats shut. Keep whichever suits the point being made and drop the other -
two figures of an empty sidebar is one more than the report needs.
