import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div id="view-landing" className="screen">
      <nav className="land-nav">
        <div className="brand">
          <div className="brand-mark"><Icon name="spark" /></div>
          <div>
            <span className="brand-name">Retrieva</span>
            <span className="brand-sub">RAG Knowledge System</span>
          </div>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#stack">Architecture</a>
        </div>
        <div className="nav-cta">
          <button className="btn btn-ghost" onClick={() => navigate("/login")}>Sign in</button>
          <button className="btn btn-primary" onClick={() => navigate("/register")}>Get started</button>
        </div>
      </nav>

      <header className="hero">
        <div>
          <span className="eyebrow"><Icon name="spark" className="icon-sm" /> Retrieval-Augmented Generation</span>
          <h1>Ask your documents <em>anything.</em> Get answers you can trust.</h1>
          <p className="lede">
            Upload PDFs, Word files and plain text. Retrieva indexes them into a vector store and
            answers your questions in natural language. Every claim comes from your own documents,
            cited down to the page.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/register")}>
              Create your knowledge base <Icon name="arrow-r" className="icon-sm" />
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate("/login")}>Sign in</button>
          </div>
          <div className="hero-meta">
            <span><Icon name="check" className="icon-sm" /> No hallucinated answers</span>
            <span><Icon name="check" className="icon-sm" /> OpenAI or local Ollama</span>
            <span><Icon name="check" className="icon-sm" /> Source-cited responses</span>
          </div>
        </div>
        <div className="demo-card" aria-hidden="true">
          <div className="demo-head">
            <span className="dot-tl"></span><span className="dot-tl"></span><span className="dot-tl"></span>
            <span className="demo-title">Retrieva · HR knowledge base</span>
          </div>
          <div className="demo-body">
            <div className="demo-q">Can unused casual leave be carried forward to next year?</div>
            <div className="demo-a">
              No. Unused casual leave lapses on <strong>31 December</strong> and does not carry
              forward<sup className="cite">1</sup>. Earned leave is the exception: it accumulates up
              to a 30-day ceiling and is encashable in the April cycle<sup className="cite">2</sup>.
            </div>
            <div className="demo-tele"><span>⌁ retrieved 5 chunks</span><span>top match 96.2%</span><span>2.1s · gpt-4o</span></div>
            <div className="demo-src">
              <Icon name="file-text" className="icon-sm" />
              <div><b>HR Policy Manual 2025.pdf</b> <span>· page 23 · §4.2 Leave carry-forward</span></div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="features">
        <div className="section-head">
          <h2>Search on meaning, not keywords</h2>
          <p>
            Traditional full-text search matches words. Retrieva matches meaning: it compares an
            embedding of your question against every chunk in the corpus.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="f-icon"><Icon name="search" /></div>
            <h3>Semantic retrieval</h3>
            <p>
              Documents are chunked, embedded and stored in ChromaDB. Queries retrieve the top-k
              most relevant passages by cosine similarity, even when they share no keywords with
              your question.
            </p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><Icon name="shield" /></div>
            <h3>Grounded, cited answers</h3>
            <p>
              Every response is generated only from retrieved context and carries source seals
              linking back to the exact document, page and passage it came from.
            </p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><Icon name="cpu" /></div>
            <h3>Your choice of model</h3>
            <p>
              Switch between OpenAI's GPT-4 family in the cloud and local inference with Ollama
              (llama3.2, qwen3, mistral). With the local option, nothing leaves your machine.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <h2>From file to answer in three steps</h2>
          <p>The ingestion pipeline runs automatically the moment a document lands.</p>
        </div>
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

      <section className="section" id="stack" style={{ paddingTop: 0 }}>
        <div className="section-head" style={{ marginBottom: 22 }}>
          <h2>Built on a modern RAG stack</h2>
        </div>
        <div className="hero-meta" style={{ gap: 14 }}>
          <span className="badge badge-gray">LangChain 0.3</span>
          <span className="badge badge-gray">ChromaDB</span>
          <span className="badge badge-gray">FastAPI</span>
          <span className="badge badge-gray">PostgreSQL 16</span>
          <span className="badge badge-gray">React 18</span>
          <span className="badge badge-gray">OpenAI · Ollama</span>
          <span className="badge badge-gray">JWT Auth</span>
        </div>
      </section>

      <footer className="land-footer">
        <span>© 2026 Retrieva · RAG Powered Knowledge System</span>
        <span>MCSP-232 · MCA Project · IGNOU</span>
      </footer>
    </div>
  );
}
