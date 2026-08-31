import Ghost from "../components/Ghost";
import Icon from "../components/Icon";
import LandingShell, { CtaBand } from "../components/LandingShell";

/* The smaller things, one line each. They are real features of the app rather
   than a wish list: everything here is reachable from the sidebar today. */
const MORE = [
  {
    icon: "activity",
    title: "Retrieval telemetry",
    body: "Every answer shows how many chunks were retrieved, the top match score, the time taken and the model used.",
  },
  {
    icon: "file-text",
    title: "Document library",
    body: "Watch each upload move through extraction, chunking and embedding, with a per-document timeline.",
  },
  {
    icon: "target",
    title: "Projects and retrieval scope",
    body: "Group documents into projects and limit a question to the documents that matter.",
  },
  {
    icon: "ghost",
    title: "Private chats",
    body: "An incognito-style mode for questions you don't want kept in your history.",
  },
  {
    icon: "mic",
    title: "Voice dictation",
    body: "Speak your question into the composer using the browser's Web Speech API.",
  },
  {
    icon: "users",
    title: "Admin and user roles",
    body: "JWT-secured sessions, with an admin role for managing documents and users.",
  },
];

export default function Features() {
  return (
    <LandingShell>
      <header className="page-head">
        <span className="eyebrow"><Icon name="grid" className="icon-sm" /> Features</span>
        <h1>Finding the right passage</h1>
        <p className="lede">
          Full-text search looks for the words you typed. Retrieva compares an embedding of your
          question against every chunk in the corpus, so a passage can match even when it uses
          different words.
        </p>
      </header>

      <section className="section">
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

      <section className="section">
        <div className="section-head tight">
          <h2>Also in the workspace</h2>
          <p>Smaller things that make the day-to-day use easier.</p>
        </div>
        <div className="more-grid">
          {MORE.map((m) => (
            <div className="more-item" key={m.title}>
              {/* The one mark in this grid that is not in the sprite. */}
              {m.icon === "ghost"
                ? <Ghost className="icon-sm" />
                : <Icon name={m.icon} className="icon-sm" />}
              <div>
                <b>{m.title}</b>
                <p>{m.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </LandingShell>
  );
}
