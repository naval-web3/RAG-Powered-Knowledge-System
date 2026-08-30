import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import LandingShell from "../components/LandingShell";

/* Six questions people ask before they upload anything. The long answers live
   on /under-the-hood; these are meant to be read standing up. */
const FAQ = [
  {
    q: "What kinds of files can I upload?",
    a: "PDF, DOCX and TXT files, up to 25 MB each. The text is extracted and split into overlapping chunks of about 1,000 characters, each stored with the document, page and position it came from.",
  },
  {
    q: "How do I know an answer is actually from my documents?",
    a: "Answers are written only from the passages that were retrieved for your question. Each claim carries a numbered seal; open it to see the document, the page and the exact passage behind it, along with how many chunks were retrieved and how closely the best one matched.",
  },
  {
    q: "Does my data leave my machine?",
    a: "Only if you choose a cloud model. Retrieva runs on OpenAI's GPT-4 family or on a local Ollama model (llama3.2, qwen3, mistral), and you can switch per question. With the local option, documents, embeddings and answers all stay on your machine.",
  },
  {
    q: "What if my question uses different words than the document?",
    a: "Retrieval is semantic, not keyword-based. Your question is turned into an embedding and compared against every chunk in the corpus by cosine similarity, so a passage about “leave carry-forward” still matches a question about “unused holidays”.",
  },
  {
    q: "Who can see what?",
    a: "Sessions are JWT-secured, with separate admin and user roles. Your chats are saved to your account so you can search them later and pick up where you left off.",
  },
  {
    q: "How do I get started?",
    a: "Create an account and upload a document, or try the demo user and demo admin shortcuts on the sign-in page first. Retrieva is an academic prototype (MCSP-232, IGNOU MCA); the source is on GitHub.",
  },
];

function Faq() {
  /* One open at a time: the answers are long enough that two of them push the
     third off the screen, and the question you just left is not the one you
     are reading. */
  const [open, setOpen] = useState(-1);

  return (
    <section className="section" id="faq">
      <div className="faq">
        <div className="faq-label">
          <h2>FAQ</h2>
          <p>
            Short answers to the questions people ask before they upload their first document.
            For the longer version, see <Link to="/under-the-hood">under the hood</Link>.
          </p>
        </div>
        <div className="faq-list">
          {FAQ.map((item, i) => (
            <div key={item.q} className={open === i ? "faq-item open" : "faq-item"}>
              <button
                className="faq-q"
                type="button"
                aria-expanded={open === i}
                aria-controls={`faq-a-${i}`}
                id={`faq-q-${i}`}
                onClick={() => setOpen((cur) => (cur === i ? -1 : i))}
              >
                {item.q}
                <Icon name="plus" />
              </button>
              <div className="faq-a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                <div><p>{item.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <LandingShell id="view-landing">
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

      <Faq />
    </LandingShell>
  );
}
