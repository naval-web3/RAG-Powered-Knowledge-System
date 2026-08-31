import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import Tooltip from "../components/Tooltip";
import MarkdownLite from "../components/MarkdownLite";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import { greetingFor } from "../utils";

/* Icon plus a key: the card is read and asked in the same language, so what
   you clicked is what appears in the transcript. */
const SUGGESTIONS = [
  { icon: "book", key: "chat.suggest.summarize" },
  { icon: "zap", key: "chat.suggest.subjects" },
  { icon: "file-text", key: "chat.suggest.sections" },
  { icon: "info", key: "chat.suggest.whatsInside" },
];

export default function ChatPage() {
  const t = useT();
  const { user } = useAuth();
  const chat = useChat();
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  /* Held in state so it does not reshuffle on every render. The screen the
     session opens on gets the fuller wording; every chat started afterwards
     re-rolls from the lighter pool.
     Keyed on the number of fresh starts rather than on a first-run flag:
     StrictMode runs effects twice on mount, and a flag would flip on the first
     pass and let the second overwrite the arrival greeting. */
  const [greeting, setGreeting] = useState(() => greetingFor(t, user?.username, true));
  useEffect(() => {
    setGreeting(greetingFor(t, user?.username, chat.freshStarts === 0));
  }, [chat.freshStarts, user?.username]);
  const fileRef = useRef(null);
  /* The word belongs to the silent wait only; once text is arriving the mark
     carries the state on its own. */
  const streaming = chat.messages.some((m) => m.streaming);

  // A different mark behaviour each time private mode is entered.
  /* The mark is also the way out. No spin first: anything between the click
     and the mode closing just reads as delay. */
  const leavePrivate = () => chat.togglePrivate();

  const empty = chat.messages.length === 0 && !chat.sending;

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
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={onAttach} />

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-col">
          {empty ? (
            <div className="chat-empty">
              {chat.privateMode ? (
                <Tooltip label={t("topbar.leavePrivate")}>
                  <button
                    type="button"
                    className="private-mark"
                    onClick={leavePrivate}
                    aria-label={t("topbar.leavePrivate")}
                  >
                    <img src="/thinking/endmark.png" alt="" width="56" height="56" />
                  </button>
                </Tooltip>
              ) : (
                <img className="empty-mark" src="/thinking/endmark.png" alt="" width="56" height="56" />
              )}
              <h2>{chat.privateMode ? t("chat.private") : greeting}</h2>
              <div className="sugg-grid">
                {SUGGESTIONS.map((s) => (
                  <button key={s.key} className="sugg" onClick={() => chat.send(t(s.key))}>
                    <Icon name={s.icon} className="icon-sm" /> {t(s.key)}
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
                  <AiMessage key={m.message_id} message={m} mark={mark} />
                );
              })}
              {chat.sending && !streaming && <Thinking />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <Composer fileRef={fileRef} rotate={empty} />
    </section>
  );
}

function UserMessage({ message }) {
  const t = useT();
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
      () => toast(t("chat.promptCopied"), "ok"),
      () => toast(t("chat.copyFailed"), "err")
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
          <Tooltip label={t("chat.copy")}>
            <button className="btn-icon" aria-label={t("chat.copy")} onClick={copy}>
              <Icon name="copy" className="icon-sm" />
            </button>
          </Tooltip>
          <Tooltip label={t("chat.editResend")}>
            <button className="btn-icon" aria-label={t("chat.editResend")} onClick={startEdit}>
              <Icon name="pencil" className="icon-sm" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

const pick = (list, avoid) => {
  const pool = list.length > 1 ? list.filter((x) => x !== avoid) : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

function Thinking() {
  const t = useT();
  /* Plain words for what the app is actually doing while it works, held as one
     "|"-joined string so a translator sees the whole set at once. */
  const words = useMemo(() => t("chat.thinkingWords").split("|"), [t]);
  const [word, setWord] = useState(() => pick(words));

  useEffect(() => {
    // One word per 3.5s, and the shine takes one pass across it in that time.
    const id = setInterval(() => setWord((prev) => pick(words, prev)), 3500);
    return () => clearInterval(id);
  }, [words]);

  // A language switch mid-wait should not leave the previous language on screen.
  useEffect(() => { setWord(pick(words)); }, [words]);

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

function AiMessage({ message, mark }) {
  const t = useT();
  const { toast } = useToast();
  const [vote, setVote] = useState(null);
  /* A copy says so on the button itself. A toast for it was a second thing to
     look at, in the opposite corner, for something the pointer is already on. */
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  function copy() {
    navigator.clipboard?.writeText(message.content).then(
      () => {
        setCopied(true);
        // Restarted, not stacked, so a second copy gets its own full second.
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1000);
      },
      // A failure still needs saying: nothing on the button would explain it.
      () => toast(t("chat.copyFailed"), "err")
    );
  }

  return (
    <div className="msg msg-ai">
      <div className="body">
        {message.thoughtMs != null && (
          <div className="thought-label">
            {t("chat.thoughtFor", { n: Math.max(1, Math.round(message.thoughtMs / 1000)) })}
          </div>
        )}
        <div className="ai-content">
          <MarkdownLite text={message.content} fadeTail={message.streaming ? 28 : 0} />
        </div>
        {message.stopped && <div className="stopped-note">{t("chat.stopped")}</div>}

        {mark && (
          <div className="answer-foot">
            <AnswerMark busy={mark === "busy"} />
          </div>
        )}

        {!message.error && !message.streaming && (
          <div className="msg-actions">
            <Tooltip label={copied ? t("chat.copied") : t("chat.copy")}>
              <button className="btn-icon" aria-label={t("chat.copy")} onClick={copy}>
                <Icon name={copied ? "check" : "copy"} className="icon-sm" />
              </button>
            </Tooltip>
            <Tooltip label={t("chat.goodAnswer")}>
              <button className={`btn-icon ${vote === "up" ? "voted" : ""}`}
                aria-label={t("chat.goodAnswer")}
                onClick={() => { setVote("up"); toast(t("chat.markedGood"), "ok"); }}>
                <Icon name={vote === "up" ? "thumb-up-fill" : "thumb-up"} className="icon-sm" />
              </button>
            </Tooltip>
            <Tooltip label={t("chat.needsWork")}>
              <button className={`btn-icon ${vote === "down" ? "voted" : ""}`}
                aria-label={t("chat.needsWork")}
                onClick={() => { setVote("down"); toast(t("chat.markedNeedsWork"), "info"); }}>
                <Icon name={vote === "down" ? "thumb-down-fill" : "thumb-down"} className="icon-sm" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

/* The prompt field cycles through a few example questions on the empty
   new-chat screen, where a blank box tells a first-time reader nothing about
   what the app can be asked. */
const PLACEHOLDER_KEYS = ["chat.placeholder", "chat.placeholder2", "chat.placeholder3"];
const PH_HOLD_MS = 5000;   // how long each prompt rests before it gives way
const PH_FADE_MS = 400;    // must match the .ta-ghost opacity transition
const PH_TYPE_MS = 45;     // per character, typing
const PH_ERASE_MS = 22;    // per character, deleting

/* TEMPORARY, while the two transitions are compared: "fade" crossfades between
   prompts, "type" types and deletes them. Switch in the console with
   localStorage.setItem("placeholderAnim", "type") and reload. Once one is
   chosen, the loser and this switch both come out. The typeof guard is for the
   smoke renderer, which runs in node where there is no localStorage. */
const PLACEHOLDER_ANIM =
  (typeof localStorage !== "undefined" && localStorage.getItem("placeholderAnim")) || "fade";

/* Returns the text to paint and whether it should be showing. Driven by a
   chain of timeouts rather than an interval: the two modes have very different
   rhythms, and a half-typed prompt must never be interrupted by the next tick. */
function useRotatingPlaceholder(active, mode, prompts) {
  const key = prompts.join("|");
  const [text, setText] = useState(prompts[0] || "");
  const [visible, setVisible] = useState(true);

  // A language switch lands on the first prompt in the new language instead of
  // leaving the old one frozen on screen.
  useEffect(() => {
    setText(prompts[0] || "");
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // Frozen, not reset: pausing on focus should leave the prompt where it is
    // rather than snapping back to the first one.
    if (!active || prompts.length < 2) return undefined;
    if (typeof window !== "undefined" && window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let stopped = false;
    let timer = null;
    let release = null;
    // Cleanup resolves the pending wait so the loop reaches its stopped check
    // and unwinds, instead of being left suspended forever.
    const wait = (ms) => new Promise((resolve) => {
      release = resolve;
      timer = setTimeout(resolve, ms);
    });

    (async () => {
      // Resume from whatever is on screen, so a blur does not restart the cycle.
      let i = prompts.indexOf(text);
      if (i < 0) i = 0;
      for (;;) {
        if (mode === "type") {
          setText(prompts[i]);
          setVisible(true);
          await wait(PH_HOLD_MS);
          if (stopped) return;
          const cur = prompts[i];
          for (let c = cur.length; c >= 0; c--) {
            setText(cur.slice(0, c));
            await wait(PH_ERASE_MS);
            if (stopped) return;
          }
          i = (i + 1) % prompts.length;
          const next = prompts[i];
          for (let c = 1; c <= next.length; c++) {
            setText(next.slice(0, c));
            await wait(PH_TYPE_MS);
            if (stopped) return;
          }
        } else {
          setText(prompts[i]);
          setVisible(true);
          await wait(PH_HOLD_MS);
          if (stopped) return;
          setVisible(false);
          await wait(PH_FADE_MS);
          if (stopped) return;
          i = (i + 1) % prompts.length;
        }
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (release) release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, key]);

  return { text, visible };
}

function Composer({ fileRef, rotate }) {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const taRef = useRef(null);
  const recRef = useRef(null);
  // Dictation keeps listening through pauses until the user explicitly stops it
  // (toggles the mic, sends, or clicks away). shouldListenRef is that intent;
  // baseTextRef holds the finalized text so interim results don't clobber it.
  const shouldListenRef = useRef(false);
  const baseTextRef = useRef("");

  // Rotation belongs to the empty new-chat screen, and stops the moment the
  // field is actually in use.
  const prompts = PLACEHOLDER_KEYS.map((k) => t(k));
  const showGhost = !!rotate && !text;
  const ph = useRotatingPlaceholder(showGhost && !focused, PLACEHOLDER_ANIM, prompts);

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
      toast(t("chat.dictationUnsupported"), "warn");
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
        toast(t("chat.micBlocked"), "warn");
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
                <span>{t("chat.scopedTo")} <b>{chat.scopeDoc.title}</b></span>
                <button className="pill-x" onClick={() => chat.setScopeDocId(null)} aria-label={t("chat.clearScope")}>
                  <Icon name="x" className="icon-sm" />
                </button>
              </span>
            )}
          </div>
        )}
        <div className="composer-box">
          <div className="ta-wrap">
            <textarea ref={taRef} rows={1} aria-label={t("chat.messageAria")}
              placeholder={showGhost ? undefined : t("chat.placeholder")}
              value={text}
              onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown} />
            {/* aria-hidden: the textarea already names itself with aria-label,
                and a prompt that changes under a screen reader is noise. */}
            {showGhost && (
              <span className={`ta-ghost ta-${PLACEHOLDER_ANIM} ${ph.visible ? "in" : ""}`}
                aria-hidden="true">{ph.text}</span>
            )}
          </div>
          <div className="composer-row">
            <AddMenu onUpload={() => fileRef.current?.click()} />
            <ModelMenu />
            <ScopeMenu />
            <div className="grow" style={{ flex: 1 }} />
            <Tooltip label={t("chat.dictate")} placement="top">
              <button className={`btn-icon mic-btn ${recording ? "rec" : ""}`}
                aria-label={t("chat.dictateAria")} onClick={toggleDictation}>
                <Icon name="mic" className="icon-sm" />
              </button>
            </Tooltip>
            {chat.sending ? (
              <Tooltip label={t("chat.stop")} placement="top">
                <button className="send-btn is-stop" aria-label={t("chat.stopGenerating")}
                  onClick={chat.stop}>
                  <Icon name="stop" className="icon-sm" />
                </button>
              </Tooltip>
            ) : text.trim() ? (
              /* Mounted with the first character rather than sitting there
                 greyed out: an empty composer has nothing to send. */
              <Tooltip label={t("chat.send")} placement="top">
                <button className="send-btn" aria-label={t("chat.send")}
                  onClick={submit}>
                  <Icon name="send" className="icon-sm" />
                </button>
              </Tooltip>
            ) : null}
          </div>
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
function modelHint(t, model) {
  return isSlowLocalModel(model) ? t("chat.modelSlow") : t("chat.modelFast");
}

/* A plus reads as "add something", not as "open a file dialog", so it opens a
   menu and the picker is one of the things on it. */
function AddMenu({ onUpload }) {
  const t = useT();
  const chat = useChat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const ready = chat.docs.filter((d) => d.processing_status === "done").length;

  return (
    <div className="menu-anchor" ref={ref}>
      <Tooltip label={chat.uploading ? t("chat.uploading") : t("chat.add")} placement="top">
        <button className="btn-icon" aria-haspopup="true" aria-expanded={open}
          aria-label={t("chat.add")} disabled={chat.uploading}
          onClick={() => setOpen((o) => !o)}>
          <Icon name={chat.uploading ? "refresh" : "plus"} className="icon-sm" />
        </button>
      </Tooltip>
      {open && (
        <div className="drop-menu add-menu">
          <button className="drop-item"
            onClick={() => { setOpen(false); onUpload(); }}>
            <span>
              <span className="d-name">{t("chat.uploadDoc")}</span>
              <span className="d-sub">{t("chat.uploadDocSub")}</span>
            </span>
          </button>
          <button className="drop-item"
            onClick={() => { setOpen(false); navigate("/documents"); }}>
            <span>
              <span className="d-name">{t("chat.browseLibrary")}</span>
              <span className="d-sub">
                {ready === 1 ? t("chat.oneDocIndexed") : t("chat.docsIndexed", { n: ready })}
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function ModelMenu() {
  const t = useT();
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
        <span className="d-name">{name}{slow && <span className="badge badge-amber" style={{ marginLeft: 6 }}>{t("chat.slow")}</span>}</span>
        <span className="d-sub">{sub}</span>
      </span>
      <Icon name="check" className="icon-sm check" />
    </button>
  );

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="model-btn" aria-haspopup="true" onClick={toggleOpen}>
        <span>{current}</span>
      </button>
      {open && (
        <div className="drop-menu">
          {chat.models.ollama.length > 0 && (
            <>
              <div className="drop-label">{t("chat.ollamaLocal")}</div>
              {chat.models.ollama.map((m) => (
                <Item key={m} value={`ollama|${m}`} name={m} sub={modelHint(t, m)} slow={isSlowLocalModel(m)} />
              ))}
            </>
          )}
          {chat.models.openai.length > 0 && (
            <>
              <div className="drop-label">{t("chat.openaiCloud")}</div>
              {chat.models.openai.map((m) => (
                <Item key={m} value={`openai|${m}`} name={m}
                  sub={chat.models.openai_enabled ? t("chat.cloudInference") : t("chat.addApiKey")} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeMenu() {
  const t = useT();
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

  const label = chat.scopeDoc ? chat.scopeDoc.title : t("chat.allDocuments");

  return (
    <div className="menu-anchor" ref={ref}>
      <button className={`model-btn scope-btn ${chat.scopeDoc ? "scoped" : ""}`} aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}>
        <Icon name="target" className="icon-sm" />
        <span id="scope-btn-label">{label}</span>
      </button>
      {open && (
        <div className="drop-menu" id="scope-menu">
          <div className="drop-label">{t("chat.retrievalScope")}</div>
          <button className={`drop-item ${!chat.scopeDoc ? "selected" : ""}`}
            onClick={() => { chat.setScopeDocId(null); setOpen(false); }}>
            <span><span className="d-name">{t("chat.allDocuments")}</span><span className="d-sub">{t("chat.wholeCorpus")}</span></span>
            <Icon name="check" className="icon-sm check" />
          </button>
          {ready.length === 0 && <div className="scope-empty">{t("chat.noScopeDocs")}</div>}
          {ready.map((d) => (
            <button key={d.document_id} className={`drop-item ${chat.scopeDocId === d.document_id ? "selected" : ""}`}
              onClick={() => { chat.setScopeDocId(d.document_id); setOpen(false); }}>
              <span><span className="d-name d-name"><span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span></span>
                <span className="d-sub">{t("chat.chunks", { n: d.chunk_count })}</span></span>
              <Icon name="check" className="icon-sm check" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
