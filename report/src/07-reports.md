# Reports and Outputs

## What This System Produces

A retrieval system's principal output is not a report in the traditional sense; it is an answer. But an answer that cannot be checked is not an output an organisation can rely on, so this system produces a *record* alongside every answer, and several reports built on those records.

Table: The outputs the system produces

| Output | Produced for | Built from | Where it is shown |
|---|---|---|---|
| A grounded answer with its citations | Every user, every question | The retrieved passages and their metadata | §7.2, and Figure 1.2 |
| The retrieval line | Every user, every answer | The provider, model, elapsed time and chunk count | §7.2 |
| The document library | Every user | `documents` | §7.3 |
| The personal usage report | Every user | That user's rows in `query_logs` and `documents` | §7.4 |
| The administrator's dashboard | Administrators | Aggregates over all four principal tables | §7.5 |
| The recent query log | Administrators | `query_logs`, newest first | §7.6 |
| The system health report | Administrators | Live probes of every dependency | §7.7 |

The approved proposal names four reports the system is to generate. Three of them are delivered in full and one in part, and the mapping is set out below rather than left for a reader to work out.

Table: The four reports the proposal names, and what is delivered

| Report the proposal names | Delivered as | Complete? |
|---|---|---|
| **User Activity Report**: login history, queries per user, documents uploaded | The personal usage report (§7.4) for the user's own figures, and the administrator's user list (§7.6) for activity across accounts. `last_login` carries the login time | Yes |
| **System Performance Report**: average query response time, embedding generation time, system uptime | The administrator's dashboard (§7.5) reports the mean response time over every question, and the health report (§7.7) reports live dependency status | **Partly.** Embedding generation time is not recorded separately from the total, and no uptime figure is claimed, for the reason given at NFR-21 |
| **Document Analytics Report**: documents per user, chunk distribution, processing success and failure rates | The dashboard's document counts and type breakdown, and the library (§7.3), where every document carries its chunk count and its state, including the reason any failure failed | Yes |
| **Query Analytics Report**: most queried topics, source document usage frequency, response quality metrics | The query log (§7.6) carries every question with its provider, model, chunk count, relevance and elapsed time | **Partly.** The raw material is all recorded, but the system does not aggregate it into topics or a quality score. §9.4 proposes what that would take |

## The Grounded Answer and Its Citations

The primary output has three layers, and each layer is a different kind of claim.

**The answer** is prose composed by the language model from the retrieved passages and nothing else.

**The retrieval line** sits immediately beneath it and is a factual record, not a summary: how many passages were used, which documents they came from, which provider and model produced the answer, and how many milliseconds the whole round trip took. It is drawn from the same values that are written to the query log, so what the user reads and what the administrator measures cannot disagree.

**The citations** are the five passages themselves, each carrying its document title, page number, section heading and relevance score, and each openable to show the passage as a quotation. The layout is described in §3.6.3 and shown in Figures 3.3 and 3.4.

The layout of one answer, then, is the following. The first panel and the
retrieval line are always on screen; the five citations appear when the count
on the retrieval line is clicked.

```text
+-------------------------------------------------------------+
| Employees are entitled to twelve days of casual leave in a  |
| calendar year, credited at the start of the year. Leave not |
| taken within the year lapses and is not carried forward.    |
+-------------------------------------------------------------+
| 5 sources . Employee Handbook 2026 . llama3.2:3b . 4187 ms  |
|   - Employee Handbook 2026 . p.7 . 4.2 Entitlement    0.41  |
|   - Employee Handbook 2026 . p.7 . 4.2 Entitlement    0.38  |
|   - Employee Handbook 2026 . p.8 . 4.3 Carry Forward  0.33  |
|   - HR Employee Handbook   . p.2 . 1.1 Scope          0.29  |
|   - Employee Handbook 2026 . p.3 . 2.0 Definitions    0.27  |
+-------------------------------------------------------------+
```

The ordering is by relevance, best first, which is the order the vector store returns them in. The score is shown rather than hidden because it is the number the relevance floor is compared against: a user who sees 0.41 at the top of one answer and 0.18 at the top of another has been told something true about how well the library covered each question.

## The Document Library

The library is a report on the state of every document a user owns: its title, type, size, upload date, chunk count and processing state. While a document is being ingested the same row carries a live progress bar drawn from the `stage` and `progress` columns, and a failed document carries the reason it failed, not a generic badge.

![The document library. Each row is a report on one document: its type, size, chunk count and state, with the reason written on any document that failed.](../docs/screenshots/11-document-library.png){width=5.9}

## The Personal Usage Report

Every user can see their own usage without an administrator's help. The report is computed per request from that user's rows and covers four things: questions asked in the current session and in the current week; totals over all time, questions, mean response time, chunks retrieved, documents held, chunks indexed and bytes stored; a breakdown of questions by the model that answered them; and a fourteen-day daily count, with gaps filled by zero so that the sparkline is continuous on days with no activity.

That last detail is a small piece of report design worth naming. A chart built only from days that have rows misrepresents a quiet week as a busy one, because the gaps close up. Filling the gaps is what makes the shape of the line mean something.

![The personal usage report. Session and weekly counts, lifetime totals, a breakdown by model, and fourteen days with the empty days kept.](../docs/screenshots/29-settings-usage.png){width=5.9}

## The Administrator's Dashboard

The dashboard aggregates across all users and answers five questions at a glance.

Table: The administrator's dashboard, fields and their sources

| Field | Source |
|---|---|
| Total users, and how many are active | `COUNT` over `users`, and over `users` where `is_active` |
| Total documents | `COUNT` over `documents` |
| Total questions asked | `COUNT` over `query_logs` |
| Mean response time | `AVG(response_time_ms)` over `query_logs` |
| Questions by provider | `COUNT` grouped by `llm_provider` |
| Documents by type | `COUNT` grouped by `file_type` |
| Questions per day, last fourteen days | `COUNT` grouped by date, gaps filled with zero |

The provider breakdown is the field with the most operational meaning in it. It answers a question an organisation deploying this system will actually ask, *how much of our traffic went to a third party?*, and it answers it from the log and not from a policy statement.

![The administrator's dashboard. Counts, the mean response time, the split by provider, and fourteen days of activity.](../docs/screenshots/32-admin-dashboard.png){width=5.9}

## The Recent Query Log

The query log report lists recent questions newest first, each with the user who asked it, the elapsed time, the number of chunks retrieved, the provider and model that served it, and the outcome. It is read from the `created_at` index, which exists for this report and for nothing else.

Two properties of the log are worth restating here, because they are what make it usable as evidence and not as a feed. It is written on **every** question, whether the answer was good, was a decline, or came back on the relevance floor's fast path, so a low chunk count in this report is itself a signal. And it **outlives its user**: the foreign key is `ON DELETE SET NULL`, so the operational history of the system does not rewrite itself every time somebody closes an account.

![The user list and the recent query log. Each row records the model that served the question, the chunks it used and the time it took.](../docs/screenshots/33-admin-users-and-logs.png){width=5.9}

## The System Health Report

The health report is the only output in the system that is not computed from stored rows. Every field is a live probe made when the page is requested, and each probe is chosen to prove the dependency is genuinely working and not merely present.

Table: The health report, what each probe actually does

| Service | Probe | Reported detail |
|---|---|---|
| PostgreSQL | Counts the tables in the `public` schema | The port, and the number of tables found |
| ChromaDB | Counts the vectors in the collection | The vector count |
| Ollama | Calls `/api/tags` with a three-second timeout | The port, and the models it is serving |
| OpenAI | Reports whether a key is configured | Configured or not, and the chat model that would be used |

Three of the four are real round trips. A connection that opens but returns nothing useful is not a healthy dependency, so PostgreSQL is asked for a count rather than pinged, Chroma is asked how many vectors it holds, and Ollama is asked which models it is serving. A running Ollama with no model pulled is a failure the user would otherwise meet as a broken answer.

The fourth is deliberately **not** a round trip. The OpenAI probe reports only whether a key is configured, and makes no call, because a health check that costs money every time an administrator opens a page is a health check that gets turned off. The system's own provider check before retrieval (§3.4.3) catches a key that is present but unusable, at the moment it matters and on somebody's actual question.
