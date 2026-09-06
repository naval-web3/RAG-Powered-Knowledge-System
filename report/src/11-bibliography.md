# Bibliography

## Papers

1. Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S. and Kiela, D. (2020). *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*. Advances in Neural Information Processing Systems 33. arXiv:2005.11401. — The paper this system's architecture is taken from.

2. Reimers, N. and Gurevych, I. (2019). *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*. Proceedings of EMNLP-IJCNLP 2019. arXiv:1908.10084. — The method behind `all-MiniLM-L6-v2`, the embedding model this system uses by default.

3. Karpukhin, V., Oğuz, B., Min, S., Lewis, P., Wu, L., Edunov, S., Chen, D. and Yih, W. (2020). *Dense Passage Retrieval for Open-Domain Question Answering*. Proceedings of EMNLP 2020. arXiv:2004.04906. — Why dense retrieval outperforms sparse retrieval on questions phrased differently from the text that answers them, which is §2.1's first failure mode.

4. Malkov, Y. A. and Yashunin, D. A. (2018). *Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs*. IEEE Transactions on Pattern Analysis and Machine Intelligence. arXiv:1603.09320. — The HNSW index ChromaDB uses, and the reason defect D4 in §5.6 behaved as it did.

5. Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., Ishii, E., Bang, Y., Madotto, A. and Fung, P. (2023). *Survey of Hallucination in Natural Language Generation*. ACM Computing Surveys 55(12). — The failure mode §2.1 describes as the second of the two existing approaches, surveyed formally.

6. Es, S., James, J., Espinosa-Anke, L. and Schockaert, S. (2024). *RAGAS: Automated Evaluation of Retrieval Augmented Generation*. Proceedings of EACL 2024. arXiv:2309.15217. — A framework for evaluating a RAG system; the test design in §5.4 is a manual instance of the same ideas.

7. Devlin, J., Chang, M., Lee, K. and Toutanova, K. (2019). *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*. Proceedings of NAACL-HLT 2019. arXiv:1810.04805. — The transformer architecture the embedding model derives from.

8. Touvron, H., Lavril, T., Izacard, G., Martinet, X., Lachaux, M., Lacroix, T., et al. (2023). *LLaMA: Open and Efficient Foundation Language Models*. Meta AI Research. arXiv:2302.13971. — The model family `llama3.2:3b` belongs to, which answers every question measured in Chapter 5.

9. Chase, H. (2022). *LangChain: Building Applications with LLMs Through Composability*. — The orchestration layer behind the prompt templates and the chat model interface in §3.4.

10. Jiang, A. Q., Sablayrolles, A., Mensch, A., Bamford, C., Chaplot, D. S., et al. (2023). *Mistral 7B*. Mistral AI. arXiv:2310.06825. — Named in the approved proposal as an alternative local model; not used, for the video-memory reason given in §2.2.1.

## Books

11. Pressman, R. S. and Maxim, B. R. (2020). *Software Engineering: A Practitioner's Approach*. 9th edition. McGraw-Hill. — The iterative and incremental model applied in §2.4, and the estimation method in §2.3.

12. Sommerville, I. (2016). *Software Engineering*. 10th edition. Pearson. — Requirements specification and the classification used in §2.5.

13. Elmasri, R. and Navathe, S. B. (2016). *Fundamentals of Database Systems*. 7th edition. Pearson. — Normalisation and the entity-relationship model, as applied in §2.7 and §3.3.1.

14. Fowler, M. (2018). *Refactoring: Improving the Design of Existing Code*. 2nd edition. Addison-Wesley. — The basis of the modularisation argument in §3.1.

15. Jurafsky, D. and Martin, J. H. (2024). *Speech and Language Processing*. 3rd edition draft. — Chapters on vector semantics and question answering.

## Documentation and Specifications

16. FastAPI documentation. `https://fastapi.tiangolo.com` — Dependency injection, which is the mechanism §4.2 relies on for access control.

17. SQLAlchemy 2.0 documentation. `https://docs.sqlalchemy.org` — The declarative ORM and the DDL emitted in §4.1.

18. ChromaDB documentation. `https://docs.trychroma.com` — Persistent client mode, metadata filtering, and the `$and` / `$in` operators used in §4.4.2.

19. LangChain documentation. `https://python.langchain.com` — Chat prompt templates, message placeholders, and the chat model interface behind `LLMProvider`.

20. Ollama documentation. `https://ollama.com` — Local model serving, the `/api/tags` endpoint used by the health check in §7.7.

21. React 18 documentation. `https://react.dev` — Hooks and the function-component model used throughout the interface.

22. PostgreSQL 16 documentation. `https://www.postgresql.org/docs/16/` — Check constraints, referential actions and the JSONB type used in §3.3.

23. Jones, M., Bradley, J. and Sakimura, N. (2015). *RFC 7519: JSON Web Token (JWT)*. IETF. — The token format and the claims used in §6.2.

24. Provos, N. and Mazières, D. (1999). *A Future-Adaptable Password Scheme*. USENIX Annual Technical Conference. — bcrypt, and why an adaptive work factor matters.

25. OWASP Foundation (2021). *OWASP Top Ten*. `https://owasp.org/Top10/` — The threat classes §6.1 is written against.

26. Indira Gandhi National Open University (2025). *MCSP-232 Project Guidelines*. School of Computer and Information Sciences. — The structure, page budget and assessable components this report is written to.
