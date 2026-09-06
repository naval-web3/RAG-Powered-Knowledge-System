# Conclusion

The problem this project set out to solve was stated in §1.2 in a form that could be tested: given an organisation's own documents and a question in natural language, produce an answer in prose, drawn only from those documents, carrying the passages it came from down to the page and section, and fast enough to be used conversationally. The system delivered does all four, and the evidence for each is in a different chapter of this report rather than in the assertion.

**Answers are in prose, and they are grounded.** Thirty-one system test cases were put through the public endpoint against a real corpus and a real local model. All thirteen single-fact cases and all nine multi-passage cases were answered correctly from the documents. The one defect found is recorded as open, with its cause identified as the model rather than the retrieval, and with a remedy proposed in §9.1 that contradicts neither of the two design rules the obvious remedies would have broken.

**The system can decline.** Five of the thirty-one cases have no answer in the corpus, and all five were declined. This is the result the whole architecture exists to produce and the one a keyword search or a bare language model cannot produce. It is defended twice: by a prompt whose grounding rules sit beneath everything else and are stated as always applying, and, behind that, by a numerical floor on the best retrieval score, tested *before* generation, on which branch the language model is never called at all. A prompt can be ignored by a model. A call that is never made cannot be.

**Attribution is part of the answer.** Every answer carries a retrieval line stating how many passages were used, from which documents, on which model, in how many milliseconds; and every passage can be opened with its page, its section and its relevance score. Those values are stored with the message and not only in the log, which is why reopening a conversation from a week ago shows the same provenance as watching the answer arrive.

**The documents need not leave the building.** Local inference is the default rather than a fallback. With Ollama and the local embedding model, the system is fully functional with the network cable out, and the deployment diagram in §3.7 is drawn so that the single optional line to a third party is visible as a single optional line.

Beyond the four, the delivered system exceeds its approved scope in four ways that §1.5 lists separately rather than folding in: optical character recognition for scanned PDFs, which the proposal placed out of scope and which testing showed to be necessary; project workspaces, which make a scope guarantee that a flat library cannot; an interface in eleven languages; and a private mode that writes nothing at all.

Three things were learned in the building that are worth stating as conclusions rather than as anecdotes.

**The interesting test cases are the ones that should fail.** A test suite made only of questions with answers reports a perfect score on a system that invents every one of them. Designing five of thirty-one cases so that an answer is a failure is what made the negative result meaningful.

**A separate process is sometimes the right concurrency primitive.** The ingestion pipeline began as a background task, deadlocked a thread pool, and hung uploads with no error anywhere because nothing had failed. Moving it into its own operating-system process cost one line of subprocess handling and removed an entire class of failure, without adding a broker, a worker or a service to install.

**An honest progress bar is a design problem, not a display problem.** The bar in the document library is truthful because each stage writes its own percentage from work actually completed, and because each stage takes the span from wherever the previous one stopped rather than a fixed slice. A fixed table looked simpler and froze the bar for the whole of the slowest phase.

The system is complete, tested, documented and installable on a machine with no internet connection. What it does not do is stated as plainly as what it does. The limits are in §2.5.4, the untested ground in §5.7, the undefended threats in §6.8, and the one open defect in §5.6. That is deliberate, because a report that lists only what worked would overstate what is known about a system whose whole purpose is to be checkable.
