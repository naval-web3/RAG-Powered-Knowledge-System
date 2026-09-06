# Testing

## Testing Strategy

A retrieval system that answers every question is not correct. It is credulous. That sentence shaped the whole test design, because it means the interesting test cases are the ones the system is supposed to *fail* to answer, and a test suite made only of questions with answers would report a perfect score on a system that invented every one of them.

Three levels of testing were used, and each was chosen for what only it can find.

**Unit testing** is white box, over the pure functions that decide what a chunk contains, what a citation can name, what may enter a system prompt and what the progress bar reports. These are the places where a wrong line changes the quality of every answer without breaking anything visibly, so they are exactly what a test suite is for. Forty-six tests, no database, no model, no network.

**Integration testing** is grey box, exercising the pipeline end to end against a real PostgreSQL and a real Chroma index. This is where the failures that only appear when two components meet were found, and every one of the defects in §5.6 is of that kind.

**System testing** is black box: thirty-one questions put through the public `POST /api/chat` endpoint against a running instance with a real corpus and a real local model, recording the answer, the sources, the chunk count, the top relevance score and the elapsed time. No knowledge of the internals is used to judge a case; a case passes if the answer is one the user should have got.

## The Test Plan

Table: The test plan

| Level | Technique | Scope | Pass criterion |
|---|---|---|---|
| Unit | White box, pure functions | Chunking and heading detection, prompt rules, progress arithmetic, password and token handling | The function returns exactly the documented value for every case, including the edge and the empty one |
| Integration | Grey box, live dependencies | Upload → extraction → OCR → chunking → embedding → indexing → retrieval | A document uploaded through the API becomes retrievable, and its progress and status reach the terminal state they should |
| System, factual | Black box | Questions the corpus answers | The answer is correct and cites the passage it came from |
| System, negative | Black box | Questions the corpus does not answer | The system declines. **An answer is a failure.** |
| System, cross-document | Black box | Questions spanning two organisations | The two are kept apart, and each fact is attributed to the document that states it |
| Performance | Measurement | The same thirty-one questions | Response time recorded per case; no case exceeds ten seconds |

## Unit Testing

### What Is Unit-Tested, and What Is Not

The unit suite covers pure functions and nothing else. That is a deliberate boundary rather than a shortfall of effort, and it is worth saying which side of the line each part of the system falls.

**Tested** are the functions whose behaviour is entirely determined by their arguments: text cleaning, heading detection, section splitting, the small-talk and conversation-question classifiers, the two functions that build the role and language lines of the prompt, brace escaping, reasoning-block stripping, the progress reporter's arithmetic, and password and token handling.

**Not unit-tested**, and covered by integration and system testing instead, are the parts whose behaviour is a property of a dependency rather than of the code: what a language model returns for a prompt, what Chroma returns for a vector, what `pypdf` extracts from a particular file. A unit test of those would be a test of a mock, and a passing test of a mock proves that the mock behaves as written.

### The Unit Test Report

Table: Unit test results

| Suite | Tests | What it establishes | Result |
|---|---|---|---|
| `test_chunking.py` | 14 | Whitespace collapse; heading detection over all-caps, numbered, roman-numeral and title-case forms; rejection of prose, of over-long lines and of bare page numbers; section attribution, including text before the first heading and a page with no heading at all | 14 pass |
| `test_rag_rules.py` | 18 | The relevance floor separates the two score populations; greetings and thanks are recognised while real questions are not; conversation questions are recognised in English, French and German; an unknown work role or locale is ignored rather than passed into a system message; braces are escaped; reasoning blocks are stripped | 18 pass |
| `test_progress.py` | 11 | Each stage ends at its own percentage; a fraction is interpolated across the stage's span; OCR starts where extraction stopped; chunking takes the OCR span when OCR did not run; progress never decreases; fractions outside 0, 1 are clamped; a write is skipped when nothing visible changed; every stage maps to a status the check constraint allows; a long detail is truncated to the column width | 11 pass |
| `test_security.py` | 3 | A password hash round-trips and rejects the wrong password; a token round-trips carrying its subject and role; a tampered token is refused | 3 pass |
| **Total** | **46** | | **46 pass**, in 2.1 s |

Two of those tests deserve to be singled out, because they assert something other than that the code works.

`test_an_unknown_work_role_is_ignored_rather_than_passed_through` puts the string *"ignore all previous instructions"* through `work_line()` and asserts that the result is `None`. That is a prompt-injection test in miniature: the work role is a value the client sends, it is used to build a **system** message, and the defence is that only keys present in a fixed table are ever used. The test is what stops that defence being removed by accident.

`test_the_phrase_list_misses_the_present_tense_of_the_same_question` asserts a **miss**. The phrase list that recognises a question aimed at the conversation contains *said* but not *say*, so *"what did you just say?"*, the commonest phrasing there is, is not caught. This is a real limitation and it is recorded as a passing test rather than hidden, so that anyone who widens the pattern later discovers that they have changed documented behaviour. The consequence is mild, and the engine's own comment says why: a miss is not fatal, because the question is still answered, merely with retrieved excerpts alongside it that it did not need.

## System Testing: The Retrieval Test

### The Corpus, and Why It Contains Two Organisations

The test corpus is three documents indexed into thirteen chunks:

- `healthcare_policy_handbook.md`, the policies of **Sunrise Valley Medical Center**, a hospital.
- `hr_employee_handbook.md`, the HR policies of **NovaTech**, a software company.
- `it_security_policy.md`, the IT security policy of the same company.

The corpus has two *different organisations* in it on purpose. A single-organisation corpus cannot detect the failure that matters most in a shared library: an answer that retrieves a passage from the right document and then attributes it to the wrong one. Two organisations with overlapping subject matter, both have grievance procedures, both have policies about who may be contacted about what, make that failure visible when it happens. It did happen once, and case 31 is where.

### The Four Classes of Question

Table: The four classes, and what each proves

| Class | Cases | What a pass proves |
|---|---|---|
| Easy | 13 | A single stated fact is retrieved and reported accurately |
| Harder | 9 | Several passages are combined into one answer without losing or inventing a detail |
| Negative | 5 | The system declines when the corpus does not cover the question. **An answer here is a failure** |
| Cross-document | 4 | Two organisations are kept apart and each fact is attributed to its own document |

Every case retrieved five chunks, which is the configured *k*, so the chunk count is not repeated in the log below.

### The Case Log

Table: System test case log, thirty-one cases

| # | Class | Question | Score | ms | Result |
|---:|---|---|---:|---:|---|
| 1 | Easy | What are the visiting hours for the ICU? | 0.535 | 4103 | PASS |
| 2 | Easy | How many beds does Sunrise Valley Medical Center have? | 0.615 | 3524 | PASS |
| 3 | Easy | Who is the Head of the Cardiology department? | 0.335 | 3839 | PASS |
| 4 | Easy | What is the ambulance dispatch number? | 0.454 | 3513 | PASS |
| 5 | Easy | What is the refundable deposit required for ICU admission? | 0.563 | 3947 | PASS |
| 6 | Harder | If a patient needs planned surgery, how far in advance must insurance be pre-approved? | 0.573 | 4095 | PASS |
| 7 | Harder | Can a 10-year-old visit a patient in the general ward? Why or why not? | 0.454 | 4298 | PASS |
| 8 | Harder | What discount does the pharmacy offer, and to whom? | 0.495 | 3441 | PASS |
| 9 | Neg. | What is the hospital's organ donation policy? | 0.326 | 3908 | PASS |
| 10 | Neg. | Does the hospital have a dedicated cancer treatment centre? | 0.445 | 4932 | PASS |
| 11 | Easy | How many casual leave days do employees get per year? | 0.571 | 3540 | PASS |
| 12 | Easy | What is the notice period for an employee with 2 years of service? | 0.599 | 3752 | PASS |
| 13 | Easy | What is the monthly internet reimbursement amount? | 0.402 | 3370 | PASS |
| 14 | Easy | How long is the probation period for new hires? | 0.568 | 4962 | PASS |
| 15 | Harder | An employee refers a candidate for an SDE-3 role who is hired. When and how is the bonus paid? | 0.460 | 4262 | PASS |
| 16 | Harder | When are appraisals conducted, and when do salary hikes take effect? | 0.454 | 4489 | PASS |
| 17 | Harder | How much monthly allowance does a fully remote employee get, compared with a hybrid one? | 0.374 | 5270 | PASS |
| 18 | Neg. | What is NovaTech's policy on international relocation? | 0.443 | 4044 | PASS |
| 19 | Neg. | Is there a dress code policy mentioned in this document? | 0.339 | 3376 | PASS |
| 20 | Easy | How often must passwords be changed? | 0.465 | 3149 | PASS |
| 21 | Easy | What is the minimum required password length? | 0.545 | 3511 | PASS |
| 22 | Easy | What is the IT Security Hotline number? | 0.389 | 3393 | PASS |
| 23 | Easy | How long does a VPN session stay active before timing out? | 0.312 | 4025 | PASS |
| 24 | Harder | An employee loses a phone with company email on it. What must they do, and within what time? | 0.560 | 4541 | PASS |
| 25 | Harder | What is the difference in incident response SLA between Critical and Medium severity? | 0.326 | 4168 | PASS |
| 26 | Harder | Which data tier requires the most restricted access, and what is an example of it? | 0.443 | 4320 | PASS |
| 27 | Neg. | What antivirus software does NovaTech use? | 0.451 | 3698 | PASS |
| 28 | Cross | Who do I contact for an HR grievance as against an IT security incident? | 0.529 | 6389 | PASS |
| 29 | Cross | Does the notice period appear in the HR policy or the IT policy? | 0.545 | 4357 | PASS |
| 30 | Cross | A NovaTech employee wants to file a harassment complaint, which document applies? | 0.568 | 4788 | PASS |
| 31 | Cross | A senior citizen patient at Sunrise Valley wants a discount on medication, does NovaTech policy apply? | 0.529 | 6031 | PARTIAL |

### Results

Table: System test results by class

| Class | Passed | Partial | Failed | Total |
|---|---:|---:|---:|---:|
| Easy | 13 | 0 | 0 | 13 |
| Harder | 9 | 0 | 0 | 9 |
| Negative | 5 | 0 | 0 | 5 |
| Cross-document | 3 | 1 | 0 | 4 |
| **Total** | **30** | **1** | **0** | **31** |

**Every factual question was answered from the documents.** All thirteen easy and all nine harder cases retrieved the right passages and answered correctly, including the multi-fact cases that required combining separate sections, the referral bonus timing, the difference between Critical and Medium incident SLAs, and the remote-work allowance comparison.

**All five negative cases declined.** Asked about an organ donation policy, international relocation, a dress code and antivirus software, none of which appear anywhere in the corpus, the system said so rather than inventing an answer. This is the result the whole architecture exists to produce, and it is the result a keyword search or a bare language model would not produce.

**One negative case is more interesting than a pass.** Asked whether the hospital has a dedicated cancer treatment centre, the system correctly reported that the documents do not say so, and then volunteered that an Oncology department is mentioned elsewhere in the handbook. That is a hedge rather than a hallucination, the additional fact is true and came from a retrieved chunk, but it answers more than was asked. It is scored as a pass because it declined the question it was asked; it is recorded here because a stricter reading would want it not to volunteer.

**One genuine defect, case 31.** The question asks whether a hospital pharmacy discount is relevant to NovaTech policy. The answer separates the two organisations correctly and cites the right document for the discount. Its final sentence then refers to *"the company's Medication & Pharmacy Policy"*, attributing the hospital's medication rule to NovaTech, which has no such policy. **The retrieval was correct**; the 3-billion-parameter model lost track of which organisation it was describing over a long answer. This is analysed in §5.6 as defect D8.

## Performance Measurement

All thirty-one cases were timed end to end, the whole round trip from the request arriving to the response leaving, including embedding, search and generation on a local 3-billion-parameter model.

Table: Response time over thirty-one cases

| Measure | Value |
|---|---|
| Mean | 4162 ms |
| Median | 4044 ms |
| Fastest | 3149 ms (case 20, a single-fact question) |
| Slowest | 6389 ms (case 28, a cross-document question with a long answer) |
| Cases over 10 s | 0 |
| Cases over 6 s | 2, both cross-document |

Three things are visible in that spread and each is explained by the design rather than by chance.

**The floor is about 3.1 seconds and it is the model, not the retrieval.** Embedding a question and searching thirteen chunks is a matter of milliseconds; generation on a 4 GB card is what the user waits for. This is why NFR-2 sets a separate, much tighter budget for retrieval alone.

**Time correlates with the length of the answer, not with the difficulty of the retrieval.** The two slowest cases are both cross-document, and both produce long answers that name two organisations, two contacts and two procedures. A local model generates at a roughly constant number of tokens per second, so a longer answer simply takes longer.

**The relevance floor makes the not-found reply the fastest response the system can produce**, because it returns without calling the model at all. No case in this run took that branch. Every question scored above the floor, including the negative ones, which is itself informative: the negative cases were declined by the *model*, correctly, on the strength of the prompt, rather than by the floor. The floor is the second line of defence and the prompt is the first, and on this corpus the first held.

## Defects Found, and What Was Done About Them

Nine defects are recorded here. Each was found by testing rather than by reading, each is described with what actually went wrong rather than with a symptom, and the last one is still open.

Table: Defect log

| Id | Found by | Defect | Resolution |
|---|---|---|---|
| D1 | Integration | Uploads stuck on `processing` for ever, with no error anywhere. Ingestion ran as a FastAPI background task; the synchronous, CPU-bound work occupied a thread-pool worker for the whole document, and a second upload could deadlock the pool. Nothing had failed, so nothing was logged | The pipeline was moved into a separate operating-system process, `app.worker`, spawned per upload (§3.2.2) |
| D2 | System | A scanned PDF was accepted, produced zero chunks, and then answered nothing, silently. The proposal had placed OCR out of scope, so a file with no text layer was a supported format with no content | Optical character recognition was added as a conditional branch: a page with no text layer is rendered at 240 dpi and recognised. A PDF that yields nothing even after OCR now fails with a reason a user can act on |
| D3 | Integration | The progress bar froze for the whole of the slowest phase. Each stage had been given a fixed span from a table, and on a scanned document OCR was handed a span that extraction had already consumed | Each stage now takes the span from wherever the previous stage finished up to its own end, allocated dynamically. This is the arithmetic covered by `test_progress.py` |
| D4 | Integration | About 160 lines of *"Delete of nonexisting embedding ID"*, and every query returning zero chunks from a backend that had been running fine. A standalone script had opened the Chroma index to delete two orphan chunks while the backend still held it, desynchronising the running HNSW index | Vector work goes through the API, or the backend is stopped first. The rule is enforceable because `vector_store.py` is the only module that touches Chroma (§3.1) |
| D5 | System | A provider failure surfaced to the user as *"I couldn't find anything in your documents"*, blaming the user's library for the system's own outage | A provider health check now runs **before** retrieval, and reports which provider failed and why: not running, no key, no credit, or a model that has not been pulled |
| D6 | System | The source passage dialog rendered as *"Page7"* and *"SectionOBJECTIVES"*, unstyled. The CSS for its metadata grid had been deleted along with an earlier version of the dialog, and restoring the component brought the markup back without its styles | The rule was restored as a base rule rather than a mobile-only override. **Test note:** a passage without a section falls back to *"chunk N"* in the same slot, and both shapes have three dot-separated parts, so a test that counts parts passes on the wrong one. Test for the `chunk N` fallback instead |
| D7 | System | On a phone the sidebar drawer opened but never closed, wore the wrong icon, and slid in *behind* the top bar so that its own header was hidden, which read as an empty drawer. Three faults in one control | The toggle became a true toggle, the icon was matched to the desktop one, the open drawer was raised above the bar, and a closing control was added inside the drawer that does not also set the desktop collapsed state |
| D8 | System | **Case 31.** The answer attributed the hospital's *"Medication & Pharmacy Policy"* to NovaTech in its closing sentence, after having separated the two organisations correctly earlier in the same answer. Retrieval was correct; the 3B model lost track of which organisation it was describing over a long answer | **Open.** Two remedies are available and neither was taken: a larger model, which contradicts the 4 GB constraint the system is built to; or naming the source document inline beside each excerpt in the prompt, which contradicts the instruction that keeps document names out of the answer text. The defect is recorded rather than papered over, and §9 proposes the compromise |
| D9 | Integration | A port left held by a process that `netstat` named but no process table contained, serving requests from a stale index | The process was found by its 497 MB memory footprint, the signature of a backend with the embedding model loaded, and ended. **Lesson recorded:** when `netstat` names a PID that does not resolve, find the process by its memory size rather than reaching for a reboot |

## What the Testing Did Not Cover

Four gaps are stated here because a test report that lists only what was tested overstates what is known.

**Scale.** The corpus is three documents and thirteen chunks. Retrieval quality at three hundred documents and thirty thousand chunks is not measured, and nearest-neighbour search behaves differently when the neighbourhood is crowded. The relevance floor in particular is calibrated against this corpus and would need re-calibrating against a larger one.

**Concurrency.** The system was tested by one user at a time. Two users uploading large documents simultaneously spawn two worker processes on a machine with six cores and 16 GB, which is within its means, but it has not been measured.

**The cloud provider path.** Every measurement in this chapter is from the local model. The OpenAI path works and is exercised manually, but it is not in the timed run, because a metered API would make the numbers a function of somebody's network rather than of this system.

**Front-end testing, and continuous integration.** The approved proposal names pytest for the backend **and Jest for the front end**, run under continuous integration. The backend half is delivered: 46 tests, run with one command. The front end has no unit tests, and there is no CI pipeline, so every test run in this report was started by hand. This is a departure from the proposal and is listed as one in §1.5.

**Documents in other languages.** Out of scope by declaration, and untested by consequence. A Hindi document will index without error and retrieve poorly, and no case in this suite demonstrates how poorly.
