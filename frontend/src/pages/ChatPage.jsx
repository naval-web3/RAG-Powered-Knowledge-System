import { useEffect, useMemo, useRef, useState } from "react";
import Composer from "../components/Composer";
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
