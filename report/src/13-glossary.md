# Glossary

Terms are defined as this system uses them, not in general. Where a general definition and this system's usage differ, the difference is stated, because that is where a reader is most likely to be misled.

Table: Glossary

| Term | Meaning in this system |
|---|---|
| **AES-256-GCM** | The cipher every uploaded document is stored under. It hides the content and authenticates it, so a file altered on disk refuses to open rather than decrypting into something subtly different |
| **bcrypt** | The adaptive, salted password hashing function used for every stored password. Deliberately slow, with a work factor that can be raised as hardware improves without invalidating existing hashes |
| **Bearer token** | The signed JWT sent in the `Authorization` header of every request to a protected endpoint |
| **Chunk** | A passage of about 1000 characters, overlapping its neighbours by 200, carrying the document, page, section and position it came from. The unit that is embedded, indexed, retrieved and cited |
| **ChromaDB** | The vector database, run embedded, a directory on disk, not a service. Holds one collection |
| **Citation** | One retrieved passage as shown to the user: its document title, page, section, relevance score and text |
| **Context** | The retrieved passages placed into the prompt. In this system the model is instructed to use the context and nothing else |
| **Cosine similarity** | The measure of closeness between two vectors. Chroma returns a *distance*; this system reports relevance as `1 − distance`, so higher is better |
| **Cross-encoder** | A model that scores a question and a passage together rather than separately. Not used in the delivered system; proposed for re-ranking in §9.2 |
| **Embedding** | The numeric vector a model produces for a piece of text. 384 dimensions locally, 1536 with the OpenAI backend. Questions and chunks are embedded by the **same** model, which is what makes them comparable |
| **Grounding** | The constraint that an answer be composed only from retrieved passages. Enforced twice here: in the prompt, and by the relevance floor, which decides before generation whether to call the model at all |
| **Hallucination** | A fluent, confident, invented answer. The failure mode this system's architecture exists to prevent |
| **HNSW** | Hierarchical Navigable Small World: the approximate nearest-neighbour index Chroma uses. Its in-memory state is why opening the index from a second process desynchronises it (defect D4) |
| **Incognito / private mode** | Answering a question and writing nothing, no conversation, no message, no query log row |
| **JWT** | JSON Web Token. Signed with HS256, carrying the user's identifier and role, valid for 60 minutes and renewed against a refresh token |
| **Key derivation** | Turning one secret into another that cannot be worked backwards. `SECRET_KEY` becomes the file encryption key this way, so one secret does two jobs without either revealing the other |
| **LangChain** | The library used to build prompt templates and to talk to both model providers behind one interface |
| **LLM** | Large language model. Here, `llama3.2:3b` or `granite4:micro` locally through Ollama, or an OpenAI model |
| **Ollama** | The local model runtime, listening on port 11434 on the same machine. What makes the system work with no network |
| **OCR** | Optical character recognition. Runs only on a PDF page with no text layer, at 240 dpi, through RapidOCR |
| **Project** | A workspace with its own standing instructions and its own set of documents. A conversation inside one retrieves **only** from those documents, and says so instead of widening the search if none are attached |
| **Prompt injection** | Text that tries to override a model's instructions. Defended against for values a client sends (whitelisted, §6.5); **not** solved for text inside an uploaded document (§6.9) |
| **Refresh token** | The second half of a session: 48 random bytes, stored only as a hash, exchanged for a new access token and spent in the exchange. Unlike a signed token it can be withdrawn, which is what makes signing out mean anything |
| **Rate limiting** | A cap on requests per address per minute, counted before authentication runs: 300 ordinarily, 10 on the routes that take a password |
| **RAG** | Retrieval-Augmented Generation. Retrieve first, then generate only from what was retrieved |
| **Relevance floor** | The threshold of 0.15 on the best retrieval score. Below it the system reports that it found nothing and the language model is **not called at all** |
| **Retrieval line** | The line beneath every answer recording how many passages were used, from which documents, on which model, and in how many milliseconds |
| **Rotation** | Replacing a refresh token every time it is used. Presenting a spent one means two clients hold it, which is how a copied token gives itself away |
| **Section** | A heading detected during ingestion and carried into a chunk's metadata, so that a citation can name §4.2 and not only page 7 |
| **Semantic search** | Matching on meaning rather than on characters. What distinguishes this system from full-text search |
| **Stage** | The fine-grained ingestion phase, extracting, ocr, chunking, embedding, indexing, that drives the progress bar. Distinct from `processing_status`, the coarse, indexed column a query filters on |
| **Standing instructions** | Free text a user or a project applies to every answer. May set role, tone, format and task; may not override the grounding rules |
| **Streaming** | Returning an answer in fragments as the model produces them. Available at `POST /api/chat/stream` |
| **top-*k*** | The number of passages retrieved per question. Five by default, configurable per user |
| **Vector store** | ChromaDB and the module that is the only thing allowed to talk to it. Holds every chunk's embedding, text and metadata |
| **Work role** | What a reader does for a living, chosen from a fixed list. Changes how an answer is explained, never what it may be drawn from. Stored as its identifier rather than its label, so it survives the interface being read in another language |
