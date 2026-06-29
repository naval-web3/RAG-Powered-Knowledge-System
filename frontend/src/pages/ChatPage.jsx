import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  IconArrowUp,
  IconChat,
  IconCheck,
  IconChevron,
  IconEdit,
  IconGhost,
  IconMore,
  IconPlus,
  IconSidebar,
  IconSpinner,
  IconTrash,
} from "../components/icons";
import pinIcon from "../assets/pin.svg";

export default function ChatPage() {
  const { user } = useAuth();
  const { incognito } = useOutletContext();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState({ ollama: [], openai: [] });
  const [sel, setSel] = useState("ollama|llama3.2:3b");
  const [loading, setLoading] = useState(false);
  const [docsReady, setDocsReady] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const resizing = useRef(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const firstName = (user?.username || "there").split(" ")[0];
  const greetName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const isWelcome = messages.length === 0 && !loading;

  useEffect(() => {
    loadConversations();
    loadDocCount();
    loadModels();
  }, []);

  async function loadModels() {
    const { data } = await client.get("/api/models");
    setModels({ ollama: data.ollama || [], openai: data.openai || [] });
    // Pick a sensible default selection.
    if ((data.ollama || []).length) {
      const def = data.ollama.includes(data.default_ollama_model)
        ? data.default_ollama_model
        : data.ollama[0];
      setSel(`ollama|${def}`);
    } else if ((data.openai || []).length) {
      setSel(`openai|${data.openai[0]}`);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Close the conversation menu on any outside click.
  useEffect(() => {
    if (menuId == null) return;
    const close = () => setMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  // Toggling incognito starts a fresh ephemeral session.
  useEffect(() => {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }, [incognito]);

  // Track mobile vs desktop; collapse the sidebar into a drawer on mobile.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsMobile(mq.matches);
      setSidebarOpen(!mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Sidebar drag-to-resize.
  useEffect(() => {
    function onMove(e) {
      if (!resizing.current) return;
      // The sidebar's left edge sits at the main content's left padding (~24px).
      const w = Math.min(460, Math.max(220, e.clientX - 24));
      setSidebarWidth(w);
    }
    function onUp() {
      resizing.current = false;
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(e) {
    e.preventDefault();
    resizing.current = true;
    document.body.style.userSelect = "none";
  }

  async function loadConversations() {
    const { data } = await client.get("/api/conversations");
    setConversations(data);
  }

  async function loadDocCount() {
    const { data } = await client.get("/api/documents");
    setDocsReady(data.filter((d) => d.processing_status === "done").length);
  }

  async function openConversation(id) {
    const { data } = await client.get(`/api/conversations/${id}`);
    setActiveId(id);
    setMessages(data.messages);
    if (isMobile) setSidebarOpen(false);
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    if (isMobile) setSidebarOpen(false);
  }

  async function deleteConversation(id, e) {
    e.stopPropagation();
    setMenuId(null);
    await client.delete(`/api/conversations/${id}`);
    if (id === activeId) newConversation();
    loadConversations();
  }

  function startRename(c, e) {
    e.stopPropagation();
    setMenuId(null);
    setEditingId(c.conversation_id);
    setEditTitle(c.title);
  }

  async function saveRename(id) {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title) return;
    await client.patch(`/api/conversations/${id}`, { title });
    loadConversations();
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg({ kind: "info", text: `Uploading ${file.name}…` });
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await client.post("/api/documents", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadMsg({ kind: "info", text: `Processing ${file.name}…` });
      let status = data.processing_status;
      for (let i = 0; i < 90 && !["done", "failed"].includes(status); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const d = (await client.get(`/api/documents/${data.document_id}`)).data;
        status = d.processing_status;
      }
      setUploadMsg(
        status === "done"
          ? { kind: "ok", text: `“${file.name}” is ready — ask a question about it.` }
          : { kind: "err", text: `“${file.name}” could not be processed.` }
      );
      loadDocCount();
    } catch (err) {
      setUploadMsg({ kind: "err", text: `Upload failed: ${err.response?.data?.detail || err.message}` });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const query = input.trim();
    if (!query || loading) return;
    setMessages((m) => [...m, { role: "user", content: query, message_id: `tmp-${Date.now()}` }]);
    setInput("");
    setLoading(true);
    try {
      const [prov, mdl] = sel.split("|");
      const { data } = await client.post("/api/chat", {
        query,
        conversation_id: activeId,
        provider: prov,
        model: mdl,
        incognito,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          message_id: `a-${Date.now()}`,
          source_documents: { sources: data.sources },
          meta: { provider: data.provider, model: data.model, ms: data.response_time_ms },
        },
      ]);
      // Incognito chats are never saved to history.
      if (!incognito) {
        setActiveId(data.conversation_id);
        loadConversations();
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${err.response?.data?.detail || err.message}`, message_id: `e-${Date.now()}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={send}
      onAttach={() => fileRef.current?.click()}
      uploading={uploading}
      loading={loading}
      models={models}
      sel={sel}
      setSel={setSel}
      uploadMsg={uploadMsg}
      dismissUpload={() => setUploadMsg(null)}
      autoFocus={isWelcome}
    />
  );

  return (
    <div className="flex h-full">
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} className="hidden" />

      {/* Reopen button when collapsed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
          className="shrink-0 self-start mr-2 sm:mr-3 p-2 rounded-lg text-muted hover:text-white hover:bg-surface transition"
        >
          <IconSidebar className="w-5 h-5" />
        </button>
      )}

      {/* Mobile drawer backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* History sidebar (inline column on desktop, slide-in drawer on mobile) */}
      {sidebarOpen && (
      <aside
        style={isMobile ? undefined : { width: sidebarWidth }}
        className={
          isMobile
            ? "fixed inset-y-0 left-0 z-40 w-[84%] max-w-xs flex flex-col bg-ink border-r border-hairline p-3"
            : "relative shrink-0 flex flex-col pr-4"
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={newConversation}
            className="flex items-center justify-center gap-2 flex-1 px-3.5 py-2.5 rounded-xl bg-move-gradient text-white text-sm font-semibold hover:opacity-95 transition ring-glow"
          >
            <IconPlus className="w-4 h-4" />
            New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface transition"
          >
            <IconSidebar className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
          Recents
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5">
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted/70">No conversations yet.</p>
          )}
          {conversations.map((c) => {
            const active = c.conversation_id === activeId;
            if (editingId === c.conversation_id) {
              return (
                <div key={c.conversation_id} className="px-1 py-0.5">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(c.conversation_id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveRename(c.conversation_id)}
                    className="w-full bg-surface2 border border-move/60 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none"
                  />
                </div>
              );
            }
            return (
              <div
                key={c.conversation_id}
                onClick={() => openConversation(c.conversation_id)}
                className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  active ? "bg-surface2 text-white" : "text-muted hover:bg-surface hover:text-white"
                }`}
              >
                <IconChat className="w-4 h-4 shrink-0 opacity-60" />
                <span className="truncate flex-1">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === c.conversation_id ? null : c.conversation_id);
                  }}
                  className={`${active || menuId === c.conversation_id ? "opacity-100" : "opacity-0"} group-hover:opacity-100 text-muted hover:text-white transition p-0.5 rounded`}
                  title="More"
                >
                  <IconMore className="w-4 h-4" />
                </button>
                {menuId === c.conversation_id && (
                  <div
                    className="absolute right-2 top-9 z-20 w-36 bg-surface2 border border-hairline rounded-xl shadow-xl py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => startRename(c, e)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-surface3/60 transition"
                    >
                      <IconEdit className="w-4 h-4" /> Rename
                    </button>
                    <button
                      onClick={(e) => deleteConversation(c.conversation_id, e)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface3/60 transition"
                    >
                      <IconTrash className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drag handle to resize the sidebar — desktop only, flush at the panel edge */}
        {!isMobile && (
          <div
            onMouseDown={startResize}
            title="Drag to resize"
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize flex justify-end group"
          >
            <div className="w-0.5 h-full bg-transparent group-hover:bg-move transition-colors" />
          </div>
        )}
      </aside>
      )}

      {/* Main panel */}
      <section className="flex-1 min-w-0 flex flex-col bg-surface border border-hairline rounded-2xl overflow-hidden">
        {isWelcome ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="w-full max-w-2xl">
              {incognito ? (
                <h1 className="flex items-center justify-center gap-2 sm:gap-3 text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-tight text-white">
                  <IconGhost className="w-7 h-7 sm:w-9 sm:h-9 text-move" />
                  You're incognito
                </h1>
              ) : (
                <h1 className="text-center text-[30px] sm:text-[44px] leading-[1.1] font-semibold tracking-tight text-white">
                  Hi, <span className="text-move-gradient">{greetName}</span>
                </h1>
              )}
              <p className="text-center text-muted text-sm sm:text-[15px] mt-3 mb-7 sm:mb-9">
                {incognito
                  ? "This chat won't be saved to your history."
                  : "How can I help you with your documents today?"}
              </p>
              {composer}
              <p className="text-center text-xs text-muted/70 mt-4">
                {incognito
                  ? "Incognito chats aren't saved to history."
                  : `${docsReady} ${docsReady === 1 ? "document" : "documents"} indexed`}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.message_id} message={m} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-muted text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-move animate-pulse" />
                    Thinking…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1">
              <div className="max-w-3xl mx-auto">{composer}</div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  onAttach,
  uploading,
  loading,
  models,
  sel,
  setSel,
  uploadMsg,
  dismissUpload,
  autoFocus,
}) {
  const taRef = useRef(null);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  const uploadStyles = {
    info: "bg-stand/10 text-stand",
    ok: "bg-exercise/10 text-exercise",
    err: "bg-move/15 text-movehi",
  };

  return (
    <div>
      {uploadMsg && (
        <div className={`mb-2 px-3 py-2 rounded-lg text-xs flex items-center justify-between ${uploadStyles[uploadMsg.kind]}`}>
          <span className="flex items-center gap-2">
            {uploadMsg.kind === "info" && <IconSpinner className="w-3.5 h-3.5" />}
            {uploadMsg.text}
          </span>
          <button onClick={dismissUpload} className="opacity-60 hover:opacity-100 ml-3">✕</button>
        </div>
      )}
      <div className="rounded-2xl border border-hairline bg-surface2 focus-within:border-surface3 transition">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask anything about your documents…"
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-white placeholder:text-muted/70 focus:outline-none"
        />
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAttach}
              disabled={uploading}
              title="Attach a document (PDF / DOCX / TXT)"
              className="p-2 rounded-lg text-muted hover:bg-surface3/50 disabled:opacity-50 transition flex items-center justify-center"
            >
              {uploading ? (
                <IconSpinner className="w-[18px] h-[18px]" />
              ) : (
                <img src={pinIcon} alt="Attach" className="w-[18px] h-[18px] invert opacity-80" />
              )}
            </button>
            <ModelMenu models={models} sel={sel} setSel={setSel} />
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !value.trim()}
            title="Send"
            className="w-9 h-9 rounded-full bg-move-gradient text-white flex items-center justify-center hover:opacity-95 disabled:bg-none disabled:bg-surface3 disabled:text-muted/50 transition"
          >
            <IconArrowUp className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelMenu({ models, sel, setSel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentName = sel.split("|")[1] || "Select model";

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const Item = ({ value, name }) => {
    const active = value === sel;
    return (
      <button
        type="button"
        onClick={() => {
          setSel(value);
          setOpen(false);
        }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-white hover:bg-surface3/70 transition"
      >
        <span className="truncate">{name}</span>
        {active && <IconCheck className="w-4 h-4 text-move shrink-0" />}
      </button>
    );
  };

  const SectionLabel = ({ children }) => (
    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Choose model"
        className="flex items-center gap-1.5 text-xs text-muted bg-transparent rounded-lg px-2 py-1.5 hover:bg-surface3/50 transition"
      >
        <span className="max-w-[160px] truncate">{currentName}</span>
        <IconChevron className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-60 bg-surface2 border border-hairline rounded-2xl shadow-2xl p-1.5 z-30">
          {models.ollama.length > 0 && (
            <>
              <SectionLabel>Local LLMs</SectionLabel>
              {models.ollama.map((m) => (
                <Item key={m} value={`ollama|${m}`} name={m} />
              ))}
            </>
          )}
          {models.openai.length > 0 && (
            <>
              <div className="my-1.5 border-t border-hairline" />
              <SectionLabel>Cloud LLMs</SectionLabel>
              {models.openai.map((m) => (
                <Item key={m} value={`openai|${m}`} name={m} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const source = message.source_documents?.sources?.[0];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-2xl rounded-br-md bg-surface2 text-white px-4 py-2.5 text-[15px] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl">
        <p className="text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap">{message.content}</p>
        {source && (
          <p className="mt-3 text-[13px] text-muted">
            <span className="font-semibold text-stand">Source:</span> {source.title}
            {source.page_number != null && <> · Page {source.page_number}</>}
            {source.section && <> · {source.section}</>}
          </p>
        )}
        {message.meta && (
          <p className="mt-1.5 text-[11px] text-muted/50">
            {message.meta.provider} · {message.meta.model} · {message.meta.ms} ms
          </p>
        )}
      </div>
    </div>
  );
}
