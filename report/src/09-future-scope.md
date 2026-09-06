# Future Scope and Further Enhancement

The enhancements below are ordered by what the delivered system's own limitations most obviously ask for, rather than by what would be most impressive to list. Four of them close a gap this report has already named.

## Closing the Gaps This Report Records

**Fix defect D8 without contradicting a design rule.** Case 31 in §5.4 is the one open defect: over a long cross-document answer, a 3-billion-parameter model attributed a hospital policy to a software company. The two obvious remedies each contradict something the system is built on. A larger model contradicts the 4 GB constraint, and naming the source document beside each excerpt in the prompt contradicts the instruction that keeps document names out of the answer text. A third option avoids both: number the excerpts by *document* rather than by position, so the prompt carries `[A1] [A2] [B1]` with a one-line key mapping each letter to a document. The model then has a token-level handle on which organisation a passage belongs to, without being invited to write a document name into its prose. This is a change to `_format_context` and the prompt, and is testable against case 31 directly.

**Defend against prompt injection in document content.** §6.8 states the limit plainly: the whitelisting that protects the system prompt covers values a *client* sends, not text inside an uploaded document. A document containing an instruction would be retrieved and placed in the context like any other passage. Two mitigations are worth trying and are worth measuring rather than assuming: delimiting each excerpt with a marker the model is told never to treat as an instruction boundary, and a lightweight classifier over chunk text at ingest time that flags imperative second-person passages for the user's attention rather than silently refusing them.

**Re-calibrate the relevance floor against a larger corpus.** The floor of 0.15 was calibrated against thirteen chunks. Nearest-neighbour scores behave differently when the neighbourhood is crowded: with thirty thousand chunks, an off-topic question is more likely to find *something* that scores moderately well, which would push false answers through a floor set for a sparse index. The right form of the enhancement is not a bigger number but an adaptive one, a floor set from the distribution of scores in the result set rather than as a constant.

**Rate limiting and transport security for a networked deployment.** Both are named as absent in §6.8. Neither is difficult; both are simply out of scope for a single-machine deployment and would be the first two things to add before serving more than the host.

## Retrieval Quality

**Hybrid retrieval.** Dense vectors match meaning and are poor at exact tokens: a question about *"policy IT-SEC-04"* or *"section 4.2"* matches semantically similar text rather than that specific identifier. Combining the vector search with a keyword index (BM25 over the same chunks, with results merged by reciprocal rank fusion) would keep the semantic strength and recover exact matching. This is the single change most likely to improve measured accuracy on a real corpus.

**Re-ranking the retrieved set.** Retrieving twenty passages and re-ranking them with a cross-encoder before taking the best five would improve the *ordering* of citations, which matters because the model reads the passages in the order given. The cost is one more model on a machine that already has little video memory to spare, so it belongs behind a setting rather than in the default path.

**Chunking that follows the document rather than the character count.** The pipeline already detects headings; it splits at 1000 characters regardless. Splitting at section boundaries first, and only falling back to a character count inside an over-long section, would mean fewer chunks that begin mid-argument.

## Documents

**More formats.** PowerPoint, HTML and spreadsheets are the obvious next three. Spreadsheets are the interesting one, because a table flattened to text loses the column structure that made it a table, and a useful implementation would have to serialise a row as a sentence rather than as a line of cells.

**Table extraction from PDFs.** §2.5.4 records that tables are extracted as text and lose their structure. This is a real quality limit, a leave entitlement table is exactly the kind of content this system is asked about, and recovering the structure would need a layout-aware extractor rather than a text one.

**Documents in languages other than English.** The interface is already in eleven languages; the *documents* are not. A multilingual embedding model would let a Hindi handbook be retrieved by a Hindi question, and the interface work is already done.

## Scale and Deployment

**Measure at scale, then decide.** §5.7 states that nothing above thirteen chunks has been measured. The enhancement is not a technology but a measurement: index a few hundred documents, re-run the thirty-one cases, and find out whether the floor, the chunk size and the value of *k* still hold. Every scaling decision after that should follow from those numbers rather than precede them.

**A shared library.** The system is deliberately per-user: every document belongs to one person. An organisation deploying it would want a team library with its own access rules, which is a schema change, a group entity, a membership table, and a second dimension in the vector store's metadata filter, rather than an interface one.

**Streaming everywhere.** The streaming endpoint exists and the interface handles it. Making it the default rather than the alternative would cut the *perceived* response time to the first token, which on a local model is a second rather than four.

## What Is Deliberately Not Proposed

Two enhancements that would ordinarily appear on such a list are left off on purpose, and saying why is part of stating the future scope honestly.

**Fine-tuning a model on the organisation's documents** is not proposed. It is the intuitive answer to *"make the model know our documents"* and it defeats the architecture: a fine-tuned model has absorbed the documents into weights, from which no citation can be produced and no correction can be made when a policy changes. Retrieval exists precisely so that the facts stay outside the model.

**Caching answers** is not proposed, for the reason given in §4.5. Two identical questions asked a week apart should see the library as it is on each day. A cache would make the system faster and occasionally, invisibly, wrong.
