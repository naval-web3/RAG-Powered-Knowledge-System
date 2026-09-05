# RAG Retrieval Test Report

**RAG Powered Knowledge System** — IGNOU MCA, MCSP-232  
System test of the retrieval-augmented generation pipeline.

## Test environment

| | |
|---|---|
| Knowledge base | 3 policy documents, 13 indexed chunks |
| Documents | `healthcare_policy_handbook.md`, `hr_employee_handbook.md`, `it_security_policy.md` |
| Embedding model | `sentence-transformers/all-MiniLM-L6-v2` (local, 384-dim) |
| Vector store | ChromaDB, cosine similarity, top-k = 5 |
| Language model | `llama3.2:3b` via Ollama (local) |
| Relevance floor | 0.15 — below this the model is skipped entirely |
| Test account | `naval.chaudhary@example.com` |

## Test design

Thirty-one questions in four classes. The classes matter: a retrieval system
that answers every question is not correct, it is credulous. **Negative** cases
have no answer in the corpus and pass only by declining; **cross-document**
cases pass only if the system keeps two organisations apart.

| Class | Cases | What it proves |
|---|---|---|
| Easy | 13 | Single-fact retrieval accuracy |
| Harder | 9 | Combining several chunks into one answer |
| Negative | 5 | Resistance to hallucination |
| Cross-document | 4 | Correct source separation |

## Results

| Class | Passed | Partial | Failed | Total |
|---|---|---|---|---|
| Easy | 13 | 0 | 0 | 13 |
| Harder | 9 | 0 | 0 | 9 |
| Negative | 5 | 0 | 0 | 5 |
| Cross-document | 3 | 1 | 0 | 4 |
| **Total** | **30** | **1** | **0** | **31** |

Response time: mean **4162 ms**, median **4044 ms**, range **3149–6389 ms** (local 3B model on an RTX 3050 4GB).

## Case log

| # | Class | Question | Chunks | Top score | Time | Result |
|---:|---|---|---:|---:|---:|---|
| 1 | Easy | What are the visiting hours for the ICU? | 5 | 0.535 | 4103 ms | PASS |
| 2 | Easy | How many beds does Sunrise Valley Medical Center have? | 5 | 0.615 | 3524 ms | PASS |
| 3 | Easy | Who is the Head of the Cardiology department? | 5 | 0.335 | 3839 ms | PASS |
| 4 | Easy | What is the ambulance dispatch number? | 5 | 0.454 | 3513 ms | PASS |
| 5 | Easy | What is the refundable deposit required for ICU admission? | 5 | 0.563 | 3947 ms | PASS |
| 6 | Harder | If a patient needs a planned surgery, how far in advance must insurance be pre | 5 | 0.573 | 4095 ms | PASS |
| 7 | Harder | Can a 10-year-old visit a patient in the general ward? Why or why not? | 5 | 0.454 | 4298 ms | PASS |
| 8 | Harder | What discount does the pharmacy offer, and to whom? | 5 | 0.495 | 3441 ms | PASS |
| 9 | Negative | What is the hospital's organ donation policy? | 5 | 0.326 | 3908 ms | PASS |
| 10 | Negative | Does the hospital have a dedicated cancer treatment center? | 5 | 0.445 | 4932 ms | PASS |
| 11 | Easy | How many casual leave days do employees get per year? | 5 | 0.571 | 3540 ms | PASS |
| 12 | Easy | What is the notice period for an employee with 2 years of service? | 5 | 0.599 | 3752 ms | PASS |
| 13 | Easy | What is the monthly internet reimbursement amount? | 5 | 0.402 | 3370 ms | PASS |
| 14 | Easy | How long is the probation period for new hires? | 5 | 0.568 | 4962 ms | PASS |
| 15 | Harder | An employee refers a candidate for an SDE-3 role who gets hired. When and how  | 5 | 0.460 | 4262 ms | PASS |
| 16 | Harder | When are performance appraisals conducted, and when do salary hikes typically  | 5 | 0.454 | 4489 ms | PASS |
| 17 | Harder | How much total monthly allowance does a fully remote employee get compared to  | 5 | 0.374 | 5270 ms | PASS |
| 18 | Negative | What is NovaTech's policy on international relocation? | 5 | 0.443 | 4044 ms | PASS |
| 19 | Negative | Is there a dress code policy mentioned in this document? | 5 | 0.339 | 3376 ms | PASS |
| 20 | Easy | How often must passwords be changed? | 5 | 0.465 | 3149 ms | PASS |
| 21 | Easy | What is the minimum required password length? | 5 | 0.545 | 3511 ms | PASS |
| 22 | Easy | What is the IT Security Hotline number? | 5 | 0.389 | 3393 ms | PASS |
| 23 | Easy | How long does a VPN session stay active before timing out? | 5 | 0.312 | 4025 ms | PASS |
| 24 | Harder | An employee loses a phone with company email on it. What must they do, and wit | 5 | 0.560 | 4541 ms | PASS |
| 25 | Harder | What is the difference in incident response SLA between Critical and Medium se | 5 | 0.326 | 4168 ms | PASS |
| 26 | Harder | Which data tier requires the most restricted access, and what's an example of  | 5 | 0.443 | 4320 ms | PASS |
| 27 | Negative | What antivirus software does NovaTech use? | 5 | 0.451 | 3698 ms | PASS |
| 28 | Cross | Who do I contact for an HR grievance vs. an IT security incident, and what's t | 5 | 0.529 | 6389 ms | PASS |
| 29 | Cross | Does the notice period appear in the HR policy or the IT policy? | 5 | 0.545 | 4357 ms | PASS |
| 30 | Cross | A NovaTech employee wants to file a harassment complaint - which document appl | 5 | 0.568 | 4788 ms | PASS |
| 31 | Cross | A senior citizen patient at Sunrise Valley Medical Center wants a discount on  | 5 | 0.529 | 6031 ms | PARTIAL |

## Observations

**Every factual question was answered from the documents.** All 13 easy and 9
harder cases retrieved the right passages and answered correctly, including
multi-fact questions that required combining separate sections — the referral
bonus timing, the difference between Critical and Medium incident SLAs, and the
remote-work allowance comparison.

**Four of five negative cases declined cleanly.** Asked about an organ donation
policy, international relocation, a dress code and antivirus software — none of
which appear in the corpus — the system said so rather than inventing an answer.
The relevance floor of 0.15 does part of this work by skipping the model
entirely when nothing scores well enough, which is both faster and safer.

**The fifth negative case is the more interesting result.** Asked whether the
hospital has a dedicated cancer treatment centre, the model correctly reported
that the documents do not say so, and then volunteered that an Oncology
department is mentioned elsewhere in the handbook. That is a hedge rather than a
hallucination — the additional fact is true and is drawn from a retrieved chunk —
but it answers more than was asked.

**One genuine defect, in case 31.** Asked whether a hospital pharmacy discount is
relevant to NovaTech policy, the answer separates the two organisations correctly
and cites the right document for the discount. Its final sentence then refers to
"the company's Medication & Pharmacy Policy" — attributing the hospital's
medication rule to NovaTech, which has no such policy. The retrieval was correct;
the 3B model lost track of which organisation it was describing over a long
answer. A larger model, or a prompt that names the source document alongside each
excerpt, would be the natural remedies.

## Reproducing this

The question set is `rag_test_questions.md`. Each case was submitted through
`POST /api/chat` against a running instance, recording the answer, the retrieved
sources, the chunk count, the top relevance score and the elapsed time.
