<!-- frontmatter -->
<!-- titlepage -->

# *Certificate of Originality

<!-- vspace 18 -->

This is to certify that the project report entitled **"RAG Powered Knowledge System"** submitted to the School of Computer and Information Sciences, Indira Gandhi National Open University, New Delhi, in partial fulfilment of the requirements for the award of the degree of **Master of Computer Applications (MCA_NEW)**, is an original work carried out by me, **Naval Chaudhary**, Enrolment Number **2354558202**, under the guidance of my project guide.

The matter embodied in this project report is genuine work done by me and has not been submitted, either to this University or to any other University or Institution, for the fulfilment of the requirement of any course of study. To the best of my knowledge, this report does not contain any material previously published or written by another person except where due acknowledgement and reference have been made in the text.

I further declare that the software developed as part of this project has been written by me, that every external library used is credited in the bibliography, and that the results, test reports and screen dumps reproduced in this report were produced by running the software I have submitted.

<!-- vspace 24 -->

<!-- signblock Signature of the Student / / Name: NAVAL CHAUDHARY / Enrolment No.: 2354558202 / Address: __________________ / __________________________ / Date: ____________________ | Signature of the Guide / / Name: ____________________ / Designation: _____________ / Address: __________________ / __________________________ / Date: ____________________ -->

# *Acknowledgement

<!-- vspace 12 -->

The completion of this project would not have been possible without the support and guidance of a number of people, and it is a pleasure to record my thanks to them here.

I am deeply grateful to my project guide for the time, patience and technical direction offered throughout the development of this system. The regular reviews shaped both the scope of the work and the discipline with which it was carried out, and several of the design decisions recorded in this report are the direct result of those discussions.

I thank the School of Computer and Information Sciences, Indira Gandhi National Open University, for the structure the MCA_NEW programme provides and for a project component that requires a student to carry an idea through analysis, design, construction and testing rather than stopping at a working demonstration. I am equally grateful to the staff of Regional Centre 11, Shimla, and of Study Centre 1105 for their administrative help.

This project stands on a large body of open work. The Retrieval-Augmented Generation architecture it implements was described by Lewis and colleagues; the retrieval quality it depends on rests on the sentence-embedding methods of Reimers and Gurevych; and the system itself is built almost entirely from open-source software — FastAPI, React, PostgreSQL, ChromaDB, LangChain, Ollama and the Llama family of models among them. I am indebted to the communities that maintain them.

Finally, I thank my family for their patience over the months in which this system was designed, written, broken, repaired and finally documented.

<!-- vspace 24 -->

<!-- signblock  | NAVAL CHAUDHARY / Enrolment No.: 2354558202 / MCA_NEW, MCSP-232 -->

# *Abstract

<!-- vspace 12 -->

Organisations hold most of what they know in unstructured documents — policy manuals, handbooks, standard operating procedures, research papers and reports. Two established ways of getting answers out of that material both fail in characteristic ways. Keyword search matches strings rather than meaning, so it misses a relevant passage that uses different words and returns irrelevant ones that happen to share a term. A large language model asked the same question answers fluently from its training data, which does not contain the organisation's private documents at all; where it lacks knowledge it invents it, and it cannot say where an answer came from.

This project addresses that gap by building a complete, working knowledge system on the Retrieval-Augmented Generation (RAG) architecture. Documents uploaded by a user are parsed, split into overlapping chunks, converted into dense vector embeddings and stored in a ChromaDB vector database alongside metadata identifying their page and section. A question asked in natural language is embedded by the same model, matched against that store by cosine similarity, and the passages that come back are placed in front of a large language model as the only material it is permitted to answer from. Every answer therefore carries its sources, and every source can be opened to the exact passage that produced it.

The system is delivered as a full-stack web application: a React 18 single-page interface, a FastAPI backend exposing a documented REST API, PostgreSQL for relational data and ChromaDB for vectors. Language model inference runs either locally through Ollama or in the cloud through OpenAI, selectable per query, so the system remains usable with no internet connection and no per-token cost. Security is enforced by JWT authentication, bcrypt password hashing and role-based access control, with a separate administrator role holding the analytics and user-management views.

Beyond the core pipeline the system implements project workspaces that scope retrieval to a chosen subset of documents, standing instructions applied to every answer, a private conversation mode that writes nothing to history, optical character recognition for scanned PDFs, and an interface translated into eleven languages. It was tested with thirty-one system test cases against a purpose-built corpus, of which thirty passed; the single partial failure is analysed in the testing chapter rather than removed from it. Mean end-to-end response time was 4.2 seconds against a local three-billion-parameter model, inside the five-second target set in the approved proposal.

<!-- pagebreak -->

# *Table of Contents

<!-- toc -->

# *List of Figures

<!-- lof -->

# *List of Tables

<!-- lot -->

<!-- arabic -->
