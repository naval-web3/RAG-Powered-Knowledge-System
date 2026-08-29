import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import MarkdownLite from "../components/MarkdownLite";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { greetingFor } from "../utils";

const SUGGESTIONS = [
  { icon: "book", q: "Summarize what my documents say." },
  { icon: "zap", q: "What subjects do my documents cover?" },
  { icon: "file-text", q: "List the sections of my most recent upload." },
  { icon: "info", q: "What's in this knowledge base?" },
];

export default function ChatPage() {
  const { user } = useAuth();
  const chat = useChat();
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const [sourceModal, setSourceModal] = useState(null);
  /* The word belongs to the silent wait only; once text is arriving the mark
     carries the state on its own. */
  const streaming = chat.messages.some((m) => m.streaming);

  // A different mark behaviour each time private mode is entered.
  /* The mark is also the way out. No spin first: anything between the click
     and the mode closing just reads as delay. */
  const leavePrivate = () => chat.togglePrivate();

  const empty = chat.messages.length === 0 && !chat.sending;
  const totalChunks = chat.docs.reduce((n, d) => n + (d.chunk_count || 0), 0);

  /* Follow the thread only when it gains a message. Streaming appends text to
     one that is already there, and scrolling on every token would pull the page
     out from under whoever is still reading the top of the answer. */
  const msgCount = useRef(0);
  useEffect(() => {
    if (chat.messages.length !== msgCount.current) {
      msgCount.current = chat.messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat.messages]);

  function onAttach(e) {
    const f = e.target.files?.[0];
    if (f) chat.uploadFile(f);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section
      className={chat.privateMode && empty ? "page is-private-empty" : "page"}
      id="page-chat"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={onAttach} />

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-col">
          {empty ? (
            <div className="chat-empty">
              {chat.privateMode ? (
                <button
                  type="button"
                  className="private-mark"
                  onClick={leavePrivate}
                  title="Leave private chat"
                  aria-label="Leave private chat"
                >
                  <img src="/thinking/endmark.png" alt="" width="56" height="56" />
                </button>
              ) : (
                <div className="spark"><Icon name="spark" /></div>
              )}
              <h2>{chat.privateMode ? "You're private" : greetingFor(user?.username)}</h2>
              {!chat.privateMode && (
                <p>Answers come from the documents you&apos;ve uploaded, with the source shown underneath.</p>
              )}
              <div className="kb-stats">
                {chat.docCount} document{chat.docCount === 1 ? "" : "s"} · {totalChunks} chunks indexed
                {chat.scopeDoc && <> · scoped to “{chat.scopeDoc.title}”</>}
              </div>
              <div className="sugg-grid">
                {SUGGESTIONS.map((s) => (
                  <button key={s.q} className="sugg" onClick={() => chat.send(s.q)}>
                    <Icon name={s.icon} className="icon-sm" /> {s.q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div id="chat-thread">
              {chat.messages.map((m, i) => {
                if (m.role === "user") return <UserMessage key={m.message_id} message={m} />;
                const last = i === chat.messages.length - 1;
                /* Breathing while this reply is still arriving; still under the
                   newest answer once everything has settled. */
                const mark = m.streaming ? "busy" : last && !chat.sending ? "idle" : null;
                return (
                  <AiMessage
                    key={m.message_id}
                    message={m}
                    onOpenSource={setSourceModal}
                    mark={mark}
                  />
                );
              })}
              {chat.sending && !streaming && <Thinking />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <Composer fileRef={fileRef} />

      {sourceModal && <SourceModal source={sourceModal} onClose={() => setSourceModal(null)} />}
    </section>
  );
}

function UserMessage({ message }) {
  const chat = useChat();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editRef = useRef(null);

  // Focus + size the editor, and put the caret at the end, when edit opens.
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    el.focus();
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  function copy() {
    navigator.clipboard?.writeText(message.content).then(
      () => toast("Prompt copied.", "ok"),
      () => toast("Couldn't copy.", "err")
    );
  }

  function startEdit() {
    setDraft(message.content);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(message.content);
  }

  function saveEdit() {
    const q = draft.trim();
    if (!q || chat.sending) return;
    setEditing(false);
    chat.send(q); // resend the edited text as a new prompt
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  if (editing) {
    return (
      <div className="msg msg-user">
        <div className="user-col">
          <div className="bubble bubble-editing">
            <textarea
              ref={editRef}
              className="bubble-edit"
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 220) + "px";
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className="bubble-edit-actions">
            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={!draft.trim() || chat.sending}>
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg msg-user">
      <div className="user-col">
        <div className="bubble">{message.content}</div>
        <div className="msg-actions user-actions">
          <button className="btn-icon" title="Copy" onClick={copy}>
            <Icon name="copy" className="icon-sm" />
          </button>
          <button className="btn-icon" title="Edit & resend" onClick={startEdit}>
            <Icon name="pencil" className="icon-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Plain words for what the app is actually doing while it works. */
const THINKING_WORDS = [
  "Thinking", "Reading", "Retrieving", "Searching", "Considering",
  "Cross-referencing", "Gathering", "Weighing", "Consulting", "Sifting",
  "Tracing", "Piecing it together",
];

const pick = (list, avoid) => {
  const pool = list.length > 1 ? list.filter((x) => x !== avoid) : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

function Thinking() {
  const [word, setWord] = useState(() => pick(THINKING_WORDS));

  useEffect(() => {
    // One word per 3.5s, and the shine takes one pass across it in that time.
    const id = setInterval(() => setWord((prev) => pick(THINKING_WORDS, prev)), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="msg thinking-row" aria-live="polite">
      <img className="thinking-mark" src="/thinking/breathe.webp" alt="" width="26" height="26" />
      {/* keyed so the fade replays on every word change */}
      <span key={word} className="thinking-word">{word}</span>
    </div>
  );
}

/* Chase runs while the reply arrives; when it lands the mark settles into the
   logo's inner motif, in the accent, with no squircle plate behind it. Breathe
   belongs to the silent wait above, before any text exists. */
const MARK_PX = 40;



function AnswerMark({ busy }) {
  return (
    <img
      className={busy ? "answer-mark" : "answer-mark is-done"}
      src={busy ? "/thinking/chase-50.webp" : "/thinking/endmark.png"}
      alt=""
      width={MARK_PX}
      height={MARK_PX}
    />
  );
}

function AiMessage({ message, onOpenSource, mark }) {
  const { toast } = useToast();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [vote, setVote] = useState(null);
  const sources = message.source_documents?.sources || [];
  const meta = message.meta;

  function copy() {
    navigator.clipboard?.writeText(message.content).then(
      () => toast("Answer copied.", "ok"),
      () => toast("Couldn't copy.", "err")
    );
  }

  return (
    <div className="msg msg-ai">
      <div className="body">
        {message.thoughtMs != null && (
          <div className="thought-label">
            Thought for {Math.max(1, Math.round(message.thoughtMs / 1000))}s
          </div>
        )}
        <div className="ai-content">
          <MarkdownLite text={message.content} fadeTail={message.streaming ? 28 : 0} />
        </div>
        {message.stopped && <div className="stopped-note">Stopped</div>}

        {/* Renders on any answer carrying metadata, not just cited ones -- it is
            now the only place the model is named. */}
        {(sources.length > 0 || meta?.model) && (
          <div className="retrieval-line">
            {meta?.model && <span>{meta.provider} · <b>{meta.model}</b></span>}
            {meta?.chunks != null && <span>⌁ retrieved <b>{meta.chunks}</b> chunk{meta.chunks === 1 ? "" : "s"}</span>}
            {meta?.top_score != null && <span>top match <b>{(meta.top_score * 100).toFixed(1)}%</b></span>}
            {meta?.ms != null && <span><b>{(meta.ms / 1000).toFixed(1)}s</b></span>}
          </div>
        )}

        {sources.length > 0 && (
          <>
            <div className={`sources-wrap ${sourcesOpen ? "open" : ""}`}>
              <button className="sources-toggle" onClick={() => setSourcesOpen((o) => !o)}>
                <Icon name="chev-r" className="icon-sm chev" />
                {sources.length} source{sources.length === 1 ? "" : "s"}
              </button>
              <div className="source-list">
                {sources.map((s, i) => (
                  <button key={i} className="source-card" onClick={() => onOpenSource(s)}>
                    <span className="s-idx">{i + 1}</span>
                    <span className="s-body">
                      <span className="s-title">{s.title}</span>
                      <span className="s-meta">
                        {s.page_number != null && <>page {s.page_number} · </>}
                        {s.section ? s.section : `chunk ${s.chunk_index ?? i}`}
                        {s.score != null && <> · {(s.score * 100).toFixed(0)}%</>}
                      </span>
                      {s.snippet && <span className="s-snip">{s.snippet}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mark && (
          <div className="answer-foot">
            <AnswerMark busy={mark === "busy"} />
          </div>
        )}

        {!message.error && !message.streaming && (
          <div className="msg-actions">
            <button className="btn-icon" title="Copy" onClick={copy}><Icon name="copy" className="icon-sm" /></button>
            <button className={`btn-icon ${vote === "up" ? "voted" : ""}`} title="Good answer"
              onClick={() => { setVote("up"); toast("Marked as a good answer.", "ok"); }}>
              <Icon name="thumb-up" className="icon-sm" />
            </button>
            <button className={`btn-icon ${vote === "down" ? "voted" : ""}`} title="Needs work"
              onClick={() => { setVote("down"); toast("Marked as needing work.", "info"); }}>
              <Icon name="thumb-down" className="icon-sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ fileRef }) {
  const chat = useChat();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const taRef = useRef(null);
  const recRef = useRef(null);
  // Dictation keeps listening through pauses until the user explicitly stops it
  // (toggles the mic, sends, or clicks away). shouldListenRef is that intent;
  // baseTextRef holds the finalized text so interim results don't clobber it.
  const shouldListenRef = useRef(false);
  const baseTextRef = useRef("");

  function joinText(a, b) {
    const left = (a || "").trim();
    const right = (b || "").trim();
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
  }

  function autoGrow(el) {
    if (!el) return;
    // Grow the box line by line (upward, since it's anchored at the bottom)
    // until the max height, then scroll so the newest line stays visible.
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 190) + "px";
    el.scrollTop = el.scrollHeight;
  }

  // Recompute height on ANY text change — typing, dictation, or programmatic
  // updates — so long input never overflows or gets clipped.
  useEffect(() => {
    autoGrow(taRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  function submit() {
    const q = text.trim();
    if (!q || chat.sending) return;
    stopDictation();
    chat.send(q);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("Voice input isn't supported in this browser.", "warn");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true; // keep listening across pauses
    rec.interimResults = true; // show words as they're spoken
    rec.onresult = (ev) => {
      let interim = "";
      let finalized = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalized += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalized) baseTextRef.current = joinText(baseTextRef.current, finalized);
      setText(joinText(baseTextRef.current, interim));
    };
    rec.onend = () => {
      // Chrome ends the session after a silence even with continuous=true.
      // Restart it ourselves so dictation only stops on an explicit action.
      if (shouldListenRef.current) {
        try { rec.start(); } catch { /* already restarting */ }
      } else {
        setRecording(false);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setRecording(false);
        toast("Microphone is blocked. Allow it in the browser to dictate.", "warn");
      }
      // Transient errors (e.g. "no-speech") are ignored; onend will restart.
    };
    recRef.current = rec;
    baseTextRef.current = text ? text.trim() : "";
    shouldListenRef.current = true;
    try { rec.start(); } catch { /* start() can throw if called twice */ }
    setRecording(true);
  }

  function stopDictation() {
    if (!shouldListenRef.current && !recording) return;
    shouldListenRef.current = false;
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  }

  function toggleDictation() {
    if (recording) stopDictation();
    else startDictation();
  }

  // While dictating, a click/tap anywhere except the mic button stops it
  // (like Windows dictation). The mic button toggles via its own handler.
  useEffect(() => {
    if (!recording) return;
    function onPointerDown(e) {
      if (e.target.closest && e.target.closest(".mic-btn")) return;
      stopDictation();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Stop recognition if the composer unmounts mid-dictation.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className="composer-zone">
      <div className="composer">
        {(chat.privateMode || chat.scopeDoc) && (
          <div className="mode-strip">
            {chat.scopeDoc && (
              <span className="mode-pill scope">
                <Icon name="target" className="icon-sm" />
                <span>Scoped to <b>{chat.scopeDoc.title}</b></span>
                <button className="pill-x" onClick={() => chat.setScopeDocId(null)} aria-label="Clear scope">
                  <Icon name="x" className="icon-sm" />
                </button>
              </span>
            )}
          </div>
        )}
        <div className="composer-box">
          <textarea ref={taRef} rows={1} placeholder="Ask your knowledge base…" aria-label="Message"
            value={text}
            onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
            onKeyDown={onKeyDown} />
          <div className="composer-row">
            <button className="btn-icon" title="Upload documents" disabled={chat.uploading}
              onClick={() => fileRef.current?.click()}>
              <Icon name={chat.uploading ? "refresh" : "clip"} className="icon-sm" />
            </button>
            <ModelMenu />
            <ScopeMenu />
            <div className="grow" style={{ flex: 1 }} />
            <button className={`btn-icon mic-btn ${recording ? "rec" : ""}`} title="Dictate with your voice"
              aria-label="Dictate" onClick={toggleDictation}>
              <Icon name="mic" className="icon-sm" />
            </button>
            {chat.sending ? (
              <button className="send-btn is-stop" aria-label="Stop generating" title="Stop"
                onClick={chat.stop}>
                <Icon name="stop" className="icon-sm" />
              </button>
            ) : (
              <button className="send-btn" disabled={!text.trim()} aria-label="Send message"
                onClick={submit}>
                <Icon name="send" className="icon-sm" />
              </button>
            )}
          </div>
        </div>
        <div className="composer-hint">
          Retrieva answers only from indexed documents. Verify critical facts against the cited source.
        </div>
      </div>
    </div>
  );
}

const SLOW_MODEL_PARAM_B = 5;
function isSlowLocalModel(model) {
  const tag = model.includes(":") ? model.split(":").pop() : model;
  const m = tag.match(/(\d+(?:\.\d+)?)\s*b/i);
  return m ? parseFloat(m[1]) >= SLOW_MODEL_PARAM_B : false;
}

/** Short speed/accuracy hint shown under each local model. */
function modelHint(model) {
  return isSlowLocalModel(model)
    ? "More accurate · slower on your GPU"
    : "Faster · may make mistakes";
}

function ModelMenu() {
  const chat = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = chat.sel.split("|")[1] || "model";

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) chat.loadModels?.(); // refresh list (picks up newly-pulled models)
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const Item = ({ value, name, sub, slow }) => (
    <button className={`drop-item ${value === chat.sel ? "selected" : ""}`}
      onClick={() => { chat.setSel(value); setOpen(false); }}>
      <span>
        <span className="d-name">{name}{slow && <span className="badge badge-amber" style={{ marginLeft: 6 }}>slow</span>}</span>
        <span className="d-sub">{sub}</span>
      </span>
      <Icon name="check" className="icon-sm check" />
    </button>
  );

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="model-btn" aria-haspopup="true" onClick={toggleOpen}>
        <span className="dot" /><span>{current}</span><Icon name="chev-d" className="icon-sm" />
      </button>
      {open && (
        <div className="drop-menu">
          {chat.models.ollama.length > 0 && (
            <>
              <div className="drop-label">Ollama · local</div>
              {chat.models.ollama.map((m) => (
                <Item key={m} value={`ollama|${m}`} name={m} sub={modelHint(m)} slow={isSlowLocalModel(m)} />
              ))}
            </>
          )}
          {chat.models.openai.length > 0 && (
            <>
              <div className="drop-label">OpenAI · cloud</div>
              {chat.models.openai.map((m) => (
                <Item key={m} value={`openai|${m}`} name={m} sub={chat.models.openai_enabled ? "cloud inference" : "add API key"} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeMenu() {
  const chat = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const ready = chat.docs.filter((d) => d.processing_status === "done");

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = chat.scopeDoc ? chat.scopeDoc.title : "All documents";

  return (
    <div className="menu-anchor" ref={ref}>
      <button className={`model-btn scope-btn ${chat.scopeDoc ? "scoped" : ""}`} aria-haspopup="true"
        title="Retrieval scope" onClick={() => setOpen((o) => !o)}>
        <Icon name="target" className="icon-sm" />
        <span id="scope-btn-label">{label}</span>
        <Icon name="chev-d" className="icon-sm" />
      </button>
      {open && (
        <div className="drop-menu" id="scope-menu">
          <div className="drop-label">Retrieval scope</div>
          <button className={`drop-item ${!chat.scopeDoc ? "selected" : ""}`}
            onClick={() => { chat.setScopeDocId(null); setOpen(false); }}>
            <span><span className="d-name">All documents</span><span className="d-sub">search the whole corpus</span></span>
            <Icon name="check" className="icon-sm check" />
          </button>
          {ready.length === 0 && <div className="scope-empty">No indexed documents to scope to yet.</div>}
          {ready.map((d) => (
            <button key={d.document_id} className={`drop-item ${chat.scopeDocId === d.document_id ? "selected" : ""}`}
              onClick={() => { chat.setScopeDocId(d.document_id); setOpen(false); }}>
              <span><span className="d-name d-name"><span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span></span>
                <span className="d-sub">{d.chunk_count} chunks</span></span>
              <Icon name="check" className="icon-sm check" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceModal({ source, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{source.title}</h3>
          <button className="btn-icon" aria-label="Close" onClick={onClose}><Icon name="x" className="icon-sm" /></button>
        </div>
        <div className="modal-body">
          <div className="meta-grid">
            {source.page_number != null && <div className="mg"><b>Page</b><span>{source.page_number}</span></div>}
            {source.section && <div className="mg"><b>Section</b><span>{source.section}</span></div>}
            {source.chunk_index != null && <div className="mg"><b>Chunk</b><span>#{source.chunk_index}</span></div>}
            {source.score != null && <div className="mg"><b>Relevance</b><span>{(source.score * 100).toFixed(1)}%</span></div>}
          </div>
          <p style={{ fontFamily: "var(--sans)", fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}>
            {source.snippet || "This passage has no preview text."}
          </p>
        </div>
      </div>
    </div>
  );
}
