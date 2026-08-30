import { Fragment } from "react";
import Icon from "../components/Icon";
import LandingShell, { CtaBand } from "../components/LandingShell";

const STACK = [
  "LangChain 0.3",
  "ChromaDB",
  "FastAPI",
  "PostgreSQL 16",
  "React 18",
  "OpenAI · Ollama",
  "JWT Auth",
];

/* The four stages a question passes through, left to right. The two stores
   hang below the middle two and are placed by class, not by order: see the
   .arch grid in retrieva.css. */
const FLOW = [
  {
    icon: "monitor",
    kicker: "Front end",
    title: "React 18 + Vite",
    body: "The chat, document library and settings. Talks to the API with a JWT in every request.",
  },
  {
    icon: "shield",
    kicker: "API",
    title: "FastAPI · JWT auth",
    body: "Issues tokens, enforces admin and user roles, and owns uploads, chats and the query endpoint.",
  },
  {
    icon: "zap",
    kicker: "Orchestration",
    title: "LangChain 0.3",
    body: "Chunks and embeds documents, runs the top-k retrieval and builds the grounded prompt.",
  },
  {
    icon: "cpu",
    kicker: "Models",
    title: "OpenAI · Ollama",
    body: "GPT-4 family in the cloud, or llama3.2, qwen3 and mistral locally. Chosen per question.",
  },
];

export default function UnderTheHood() {
  return (
    <LandingShell>
      <header className="page-head">
        <span className="eyebrow"><Icon name="activity" className="icon-sm" /> Under the hood</span>
        <h1>What happens to a file after you upload it</h1>
        <p className="lede">
          The pipeline runs on its own, and you can watch it in the document library. Below: the
          three stages a document goes through, and the stack that runs them.
        </p>
      </header>

      <section className="section">
        <div className="steps">
          <div className="step">
            <h3>Upload your documents</h3>
            <p>Drop in PDF, DOCX or TXT files. The text is extracted and split into overlapping chunks of about 1,000 characters.</p>
          </div>
          <div className="step">
            <h3>Index into vectors</h3>
            <p>Each chunk becomes a high-dimensional embedding, stored in ChromaDB alongside its document, page and position metadata.</p>
          </div>
          <div className="step">
            <h3>Ask in plain language</h3>
            <p>Your question is embedded and matched against the corpus; the best passages go to the LLM, which writes a cited answer.</p>
          </div>
        </div>
      </section>

      <section className="section" id="stack">
        <div className="section-head tight">
          <h2>What it's built on</h2>
          <p>
            A React front end talking to a FastAPI back end. PostgreSQL keeps the records,
            ChromaDB keeps the vectors, and LangChain wires the retrieval and the model together.
          </p>
        </div>
        <div className="hero-meta" style={{ gap: 14 }}>
          {STACK.map((s) => (
            <span className="badge badge-gray" key={s}>{s}</span>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head tight">
          <h2>How a request moves</h2>
          <p>
            Left to right for a question; the two stores underneath are written at upload time
            and read at query time.
          </p>
        </div>
        <div className="arch">
          {FLOW.map((n, i) => (
            /* The arrow belongs between two nodes, so it is emitted with the
               node that follows it rather than as its own list. */
            <Fragment key={n.title}>
              {i > 0 && (
                <div className="arch-arrow"><Icon name="arrow-r" className="icon-sm" /></div>
              )}
              <div className="arch-node">
                <div className="kicker"><Icon name={n.icon} className="icon-sm" /> {n.kicker}</div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            </Fragment>
          ))}

          <div className="arch-down pg"><Icon name="arrow-r" className="icon-sm" /></div>
          <div className="arch-node store arch-store pg">
            <div className="kicker"><Icon name="db" className="icon-sm" /> Records</div>
            <h3>PostgreSQL 16</h3>
            <p>Users and roles, document metadata, saved chats.</p>
          </div>

          <div className="arch-down chroma"><Icon name="arrow-r" className="icon-sm" /></div>
          <div className="arch-node store arch-store chroma">
            <div className="kicker"><Icon name="db" className="icon-sm" /> Vectors</div>
            <h3>ChromaDB</h3>
            <p>One embedding per chunk, with document, page and position metadata for the citations.</p>
          </div>
        </div>
      </section>

      <CtaBand />
    </LandingShell>
  );
}
