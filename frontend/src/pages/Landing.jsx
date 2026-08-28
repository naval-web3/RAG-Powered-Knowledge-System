import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { getThemePref, setTheme } from "../theme";

const REPO = "https://github.com/naval-web3/RAG-Powered-Knowledge-System";

const THEMES = [
  { id: "system", icon: "monitor", label: "Match system" },
  { id: "light", icon: "sun", label: "Light" },
  { id: "dark", icon: "moon", label: "Dark" },
];

export default function Landing() {
  const navigate = useNavigate();
  /* The nav rides as a centred pill at the top of the page and docks into a
     full-bleed bar once you scroll past it. */
  const [docked, setDocked] = useState(false);
  const tripRef = useRef(null);
  const [themePref, setThemePref] = useState(getThemePref);

  const pickTheme = (pref) => {
    setTheme(pref);
    setThemePref(pref);
  };

  /* Watch a fixed 80px sentinel pinned to the top of the page rather than
     sampling window.scrollY. The sentinel sits outside the flow, so the nav
     resizing cannot move it: the state flips once, at exactly one offset,
     with no chance of the threshold re-firing mid-transition. */
  useEffect(() => {
    const trip = tripRef.current;
    if (!trip || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setDocked(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(trip);
    return () => io.disconnect();
  }, []);

  return (
    <div id="view-landing" className="screen">
      <div ref={tripRef} className="nav-trip" aria-hidden="true" />
      <nav className={docked ? "land-nav is-docked" : "land-nav"}>
        <div className="land-nav-bar">
          <div className="land-nav-row">
            <div className="brand">
              <img className="brand-mark" src="/logo.png" alt="" width="32" height="32" />
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
              <button className="btn btn-primary btn-shine" onClick={() => navigate("/register")}>Get started</button>
            </div>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div>
          <span className="eyebrow"><Icon name="spark" className="icon-sm" /> Retrieval-Augmented Generation</span>
          <h1>Ask your documents <em>anything.</em> See where every answer came from.</h1>
          <p className="lede">
            Upload PDFs, Word files and plain text. Retrieva indexes them into a vector store and
            answers in plain language. Each answer names the document and page it came from.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg btn-shine" onClick={() => navigate("/register")}>
              Create your knowledge base <Icon name="arrow-r" className="icon-sm" />
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate("/login")}>Sign in</button>
          </div>
          <div className="hero-meta">
            <span><Icon name="check" className="icon-sm" /> Answers quote your own documents</span>
            <span><Icon name="check" className="icon-sm" /> Runs on OpenAI or a local Ollama model</span>
          </div>
        </div>
        <div className="demo-card" aria-hidden="true">
          <div className="demo-head">
            <span className="dot-tl dot-r"></span><span className="dot-tl dot-y"></span><span className="dot-tl dot-g"></span>
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
          <h2>Finding the right passage</h2>
          <p>
            Full-text search looks for the words you typed. Retrieva compares an embedding of your
            question against every chunk in the corpus, so a passage can match even when it uses
            different words.
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
              Answers use only the passages that were retrieved. Each one links back to the
              document and page it came from.
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
          <h2>What happens to a file after you upload it</h2>
          <p>The pipeline runs on its own, and you can watch it in the document library.</p>
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
          <h2>What it's built on</h2>
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
        <div className="foot-top">
          <div className="foot-brand">
            <div className="foot-logo">
              <img src="/logo.png" alt="" width="30" height="30" />
              <span>Retrieva</span>
            </div>
            <p className="foot-tagline">Answers you can trace back to the page they came from.</p>
          </div>

          <nav className="foot-cols" aria-label="Footer">
            <div className="foot-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#stack">Architecture</a>
            </div>
            <div className="foot-col">
              <h4>Get started</h4>
              <Link to="/register">Create an account</Link>
              <Link to="/login">Sign in</Link>
              <Link to="/forgot-password">Reset password</Link>
            </div>
            <div className="foot-col">
              <h4>Project</h4>
              <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
              <span>MCSP-232 · MCA</span>
              <span>IGNOU · RC Shimla</span>
            </div>
          </nav>
        </div>

        <div className="foot-bottom">
          <span>© 2026 Retrieva · RAG Powered Knowledge System</span>
          <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={themePref === t.id}
                aria-label={t.label}
                title={t.label}
                onClick={() => pickTheme(t.id)}
              >
                <Icon name={t.icon} />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
