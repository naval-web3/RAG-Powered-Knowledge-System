import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";

/**
 * The prompt box, and the three menus that live on its bottom row.
 *
 * It is shared: the chat page mounts it docked to the bottom of the thread,
 * and a project page mounts it inline at the top of its own column. What
 * differs between the two is passed in rather than branched on here --
 * where a submitted question goes (onSubmit), whether the retrieval-scope
 * menu is offered at all (a project already answers that question for
 * itself), and whether the placeholder rotates.
 */

/* The prompt field cycles through a few example questions on the empty
   new-chat screen, where a blank box tells a first-time reader nothing about
   what the app can be asked. */
const PLACEHOLDER_KEYS = ["chat.placeholder", "chat.placeholder2", "chat.placeholder3"];
const PH_HOLD_MS = 5000;   // how long each prompt rests before it gives way
const PH_TYPE_MS = 45;     // per character, typing
const PH_ERASE_MS = 22;    // per character, deleting

/* Returns the text to paint. Driven by a chain of timeouts rather than an
   interval: erasing and typing run at different rates and neither is a whole
   number of ticks, so a half-typed prompt must never be cut off by the next
   one coming due. */
function useRotatingPlaceholder(active, prompts) {
  const key = prompts.join("|");
  const [text, setText] = useState(prompts[0] || "");
  // Which prompt the animation is currently working towards, so a pause can
  // finish the job instead of guessing from a prefix that several prompts and
  // the empty string all match.
  const targetRef = useRef(0);

  // A language switch lands on the first prompt in the new language instead of
  // leaving the old one frozen on screen.
  useEffect(() => {
    setText(prompts[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /* Focus can land mid-word, and half a prompt sitting in the box reads as a
     bug rather than an animation. Stopping completes the prompt instead of
     freezing on whatever character it had reached. Safe against the loop
     writing over it: the loop only resumes inside a microtask, and its first
     act after waking is to see it has been stopped and return. */
  useEffect(() => {
    if (active) return;
    setText(prompts[targetRef.current] || prompts[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  useEffect(() => {
    // Frozen, not reset: pausing should leave the prompt where it is rather
    // than snapping back to the first one.
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
      targetRef.current = i;
      for (;;) {
        setText(prompts[i]);
        await wait(PH_HOLD_MS);
        if (stopped) return;
        const cur = prompts[i];
        for (let c = cur.length; c >= 0; c--) {
          setText(cur.slice(0, c));
          await wait(PH_ERASE_MS);
          if (stopped) return;
        }
        i = (i + 1) % prompts.length;
        targetRef.current = i;
        const next = prompts[i];
        for (let c = 1; c <= next.length; c++) {
          setText(next.slice(0, c));
          await wait(PH_TYPE_MS);
          if (stopped) return;
        }
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (release) release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  return text;
}

export default function Composer({
  fileRef, rotate, onSubmit, scope = true, placeholder, className = "",
}) {
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
  // What was in the box before dictation started, so discarding puts it back
  // rather than clearing whatever was already written.
  const preDictRef = useRef("");

  // Rotation belongs to the empty new-chat screen, and stops the moment the
  // field is actually in use.
  const prompts = PLACEHOLDER_KEYS.map((k) => t(k));
  const showGhost = !!rotate && !text && !recording;
  const phText = useRotatingPlaceholder(showGhost && !focused, prompts);

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
    if (onSubmit) onSubmit(q);
    else chat.send(q);
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
    preDictRef.current = text;
    baseTextRef.current = text ? text.trim() : "";
    shouldListenRef.current = true;
    try { rec.start(); } catch { /* start() can throw if called twice */ }
    setRecording(true);
  }

  function stopDictation() {
    if (!shouldListenRef.current && !recording) return;
    shouldListenRef.current = false;
    const rec = recRef.current;
    if (rec) {
      /* Detaching the handlers is what actually ends a dictation; stop() only
         gives the microphone back, and it is asynchronous -- Chrome flushes
         whatever it has already heard as one last onresult BEFORE onend. That
         handler still closes over setText, so discarding used to be undone a
         moment later by words arriving after the ✕ had been pressed. Accepting
         takes the same route on purpose: what you read back is what you get,
         rather than the text changing once more after you agreed to it. */
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try { rec.stop(); } catch { /* ignore */ }
      recRef.current = null;
    }
    setRecording(false);
  }

  function toggleDictation() {
    if (recording) stopDictation();
    else startDictation();
  }

  /* Keep what was heard. The text is already in the box -- accepting only stops
     the listening and lets it go from provisional to ordinary. */
  function acceptDictation() {
    stopDictation();
  }

  /* Throw it away and put back whatever was in the box beforehand. */
  function discardDictation() {
    stopDictation();
    setText(preDictRef.current);
  }

  /* There is deliberately no stop-on-click-away. Dictation used to end on any
     click outside the mic, which made sense while the mic was the only control;
     now that accepting and discarding are two visible buttons, a stray click
     silently ending a recording would lose words with no way to tell which. */

  // Stop recognition if the composer unmounts mid-dictation.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className={className ? `composer-zone ${className}` : "composer-zone"}>
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
              className={recording ? "is-dictating" : undefined}
              placeholder={recording ? t("chat.listening")
                : showGhost ? undefined : (placeholder || t("chat.placeholder"))}
              value={text}
              onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown} />
            {/* aria-hidden: the textarea already names itself with aria-label,
                and a prompt that changes under a screen reader is noise. */}
            {showGhost && (
              <span className="ta-ghost" aria-hidden="true">{phText}</span>
            )}
          </div>
          <div className="composer-row">
            <AddMenu onUpload={() => fileRef.current?.click()} />
            <ModelMenu />
            {scope && <ScopeMenu />}
            <div className="grow" style={{ flex: 1 }} />
            {/* The mic holds the slot only while the box is empty. Accepting a
                dictation leaves text behind, and the tick is only pressed after
                the words have been read back, so at that point the thing wanted
                in that corner is the send button, not another mic. While it is
                listening the mic gives its place to the two buttons that end it. */}
            {!recording && !text.trim() && (
              <Tooltip label={t("chat.dictate")} placement="top">
                <button className="btn-icon mic-btn"
                  aria-label={t("chat.dictateAria")} onClick={toggleDictation}>
                  <Icon name="mic" className="icon-sm" />
                </button>
              </Tooltip>
            )}
            {recording ? (
              <div className="dict-actions">
                <Tooltip label={t("common.cancel")} placement="top">
                  <button className="btn-icon" aria-label={t("common.cancel")}
                    onClick={discardDictation}>
                    <Icon name="x" className="icon-sm" />
                  </button>
                </Tooltip>
                <Tooltip label={t("chat.dictateAccept")} placement="top">
                  <button className="btn-icon dict-ok" aria-label={t("chat.dictateAccept")}
                    onClick={acceptDictation}>
                    <Icon name="check" className="icon-sm" />
                  </button>
                </Tooltip>
              </div>
            ) : chat.sending ? (
              <Tooltip label={t("chat.stop")} placement="top">
                <button className="send-btn is-stop" aria-label={t("chat.stopGenerating")}
                  onClick={chat.stop}>
                  <Icon name="stop" className="icon-sm" />
                </button>
              </Tooltip>
            ) : text.trim() ? (
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
