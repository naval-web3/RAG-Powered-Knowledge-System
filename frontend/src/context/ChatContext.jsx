import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useLocale } from "../i18n";
import { useToast } from "./ToastContext";

const ChatContext = createContext(null);

/* The fine stages document_processor.py persists, in plain words. Anything it
   reports that is not on this list still shows a sensible label rather than a
   blank one. */
const STAGE_LABEL = {
  extracting: "upload.extracting",
  ocr: "upload.ocr",
  chunking: "upload.chunking",
  embedding: "upload.embedding",
  indexing: "upload.indexing",
};

export function ChatProvider({ children }) {
  const { toast, progressToast, updateToast, settleToast } = useToast();
  // Sent with every question so answers come back in the reader's language.
  const { locale, t } = useLocale();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(null);
  // Mirrored in a ref because send() often runs in the same tick as the call
  // that switched project (starting a chat from the project page), and a state
  // update would not be visible to send's closure until the next render.
  const activeProjectRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [privateLeaving, setPrivateLeaving] = useState(false);
  const [freshStarts, setFreshStarts] = useState(0);
  const abortRef = useRef(null);
  const [loadingConv, setLoadingConv] = useState(false);

  const [privateMode, setPrivateMode] = useState(false);

  const [models, setModels] = useState({ ollama: [], openai: [], openai_enabled: false });
  const [sel, setSel] = useState("ollama|llama3.2:3b");

  const [docs, setDocs] = useState([]);
  // Which document the preview dialog is showing. It lives here because both
  // the sidebar and the documents page open it.
  const [openDoc, setOpenDoc] = useState(null);
  const [scopeDocId, setScopeDocId] = useState(null);

  const [uploading, setUploading] = useState(false);
  // { name, pct } while a file is being sent to the server, else null.
  // This is real byte progress from the request, not an estimate.
  const [uploadProgress, setUploadProgress] = useState(null);

  const docCount = docs.filter((d) => d.processing_status === "done").length;
  const scopeDoc = docs.find((d) => d.document_id === scopeDocId) || null;

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await client.get("/api/conversations");
      // Pinned chats rise to the top; the API already returns newest first, so
      // a stable sort on the flag alone preserves that order within each group.
      data.sort((a, b) => Number(b.pinned) - Number(a.pinned));
      setConversations(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDocs = useCallback(async () => {
    try {
      const { data } = await client.get("/api/documents");
      setDocs(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const { data } = await client.get("/api/models");
      const ollama = data.ollama || [];
      const openai = data.openai || [];
      setModels({ ollama, openai, openai_enabled: !!data.openai_enabled });
      // Only (re)pick a default when the current selection isn't actually
      // available — so re-fetching the list never clobbers the user's choice.
      setSel((cur) => {
        const [prov, mdl] = cur.split("|");
        const valid =
          (prov === "ollama" && ollama.includes(mdl)) ||
          (prov === "openai" && openai.includes(mdl));
        if (valid) return cur;
        if (ollama.length) {
          const def = ollama.includes(data.default_ollama_model) ? data.default_ollama_model : ollama[0];
          return `ollama|${def}`;
        }
        if (openai.length) return `openai|${openai[0]}`;
        return cur;
      });
    } catch {
      /* ignore */
    }
  }, []);

  const setActiveProject = useCallback((id) => {
    activeProjectRef.current = id || null;
    setActiveProjectIdState(id || null);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await client.get("/api/projects");
      setProjects(data || []);
    } catch {
      /* non-fatal: the sidebar simply shows no projects */
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadDocs();
    loadModels();
    loadProjects();
  }, [loadConversations, loadDocs, loadModels, loadProjects]);

  const createProject = useCallback(
    async (name) => {
      const { data } = await client.post("/api/projects", { name });
      await loadProjects();
      return data;
    },
    [loadProjects]
  );

  const updateProject = useCallback(
    async (id, patch) => {
      const { data } = await client.patch(`/api/projects/${id}`, patch);
      await loadProjects();
      return data;
    },
    [loadProjects]
  );

  const setProjectDocuments = useCallback(
    async (id, docScope, documentIds) => {
      const { data } = await client.put(`/api/projects/${id}/documents`, {
        doc_scope: docScope,
        document_ids: documentIds,
      });
      await loadProjects();
      return data;
    },
    [loadProjects]
  );

  const deleteProject = useCallback(
    async (id) => {
      await client.delete(`/api/projects/${id}`);
      if (activeProjectRef.current === id) setActiveProject(null);
      await loadProjects();
      loadConversations();
    },
    [loadProjects, loadConversations, setActiveProject]
  );

  // projectId is optional; guard against being wired straight to an onClick,
  // which would otherwise pass the click event in as the project.
  const newChat = useCallback(
    (projectId) => {
      setActiveProject(typeof projectId === "string" ? projectId : null);
      setActiveId(null);
      setMessages([]);
      /* A scoped document belongs to the conversation it was chosen for, not
         to the session. Carrying it into the next chat silently narrows a
         search the user thinks is over everything -- and the pill saying so
         sits above a composer they have already looked away from. */
      setScopeDocId(null);
      // Counts fresh starts. Zero means this is still the screen the session
      // opened on, which is what decides how warmly it greets you.
      setFreshStarts((n) => n + 1);
    },
    [setActiveProject]
  );

  const openConversation = useCallback(
    async (id) => {
      // Opening it is what clears the marker; nothing sets it automatically.
      client.patch(`/api/conversations/${id}`, { unread: false }).catch(() => {});
      if (privateMode) setPrivateMode(false);
      setLoadingConv(true);
      try {
        const { data } = await client.get(`/api/conversations/${id}`);
        setActiveId(id);
        setActiveProject(data.project_id || null);
        setMessages(data.messages || []);
        // Same reason as newChat, and only once the switch has actually
        // happened: a failed open leaves you where you were, scope included.
        setScopeDocId(null);
      } catch {
        toast("Couldn't open that conversation", "err");
      } finally {
        setLoadingConv(false);
      }
    },
    [privateMode, setActiveProject, toast]
  );

  const renameConversation = useCallback(
    async (id, title) => {
      const clean = (title || "").trim();
      if (!clean) return;
      /* Written into the list before the request goes out. The field closes on
         this same tick, so anything that reads the title -- the row, and the
         name in the top bar -- would otherwise paint the OLD one until the
         round trip came back and replaced it. That gap is the flicker. */
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === id ? { ...c, title: clean } : c))
      );
      try {
        await client.patch(`/api/conversations/${id}`, { title: clean });
        loadConversations();
      } catch {
        // Put the real name back: the optimistic one was a guess that lost.
        loadConversations();
        toast("Rename failed", "err");
      }
    },
    [loadConversations, toast]
  );

  /** Set pinned/unread on a conversation. Only the fields given are sent. */
  const setConversationFlags = useCallback(
    async (id, flags) => {
      try {
        await client.patch(`/api/conversations/${id}`, flags);
        loadConversations();
      } catch {
        toast("Couldn't update that chat", "err");
      }
    },
    [loadConversations, toast]
  );

  /* Files a chat under a project, or takes it out of one when projectId is
     null. The backend tells "sent as null" apart from "not sent", so null here
     really does clear the field rather than being ignored. */
  const moveConversation = useCallback(
    async (id, projectId) => {
      try {
        await client.patch(`/api/conversations/${id}`, { project_id: projectId });
        loadConversations();
      } catch {
        toast("Couldn't move that chat", "err");
      }
    },
    [loadConversations, toast]
  );

  const deleteConversation = useCallback(
    async (id) => {
      try {
        await client.delete(`/api/conversations/${id}`);
        if (id === activeId) newChat();
        loadConversations();
        toast("Chat deleted", "ok");
      } catch {
        toast("Delete failed", "err");
      }
    },
    [activeId, newChat, loadConversations, toast]
  );

  const renameDocument = useCallback(
    async (id, title) => {
      const clean = (title || "").trim();
      if (!clean) return;
      // Optimistic for the same reason renameConversation is: see the note there.
      setDocs((prev) =>
        prev.map((d) => (d.document_id === id ? { ...d, title: clean } : d))
      );
      try {
        await client.patch(`/api/documents/${id}`, { title: clean });
        loadDocs();
      } catch {
        loadDocs();
        toast(t("docs.renameFailed"), "err");
      }
    },
    [loadDocs, toast, t]
  );

  /* Pinning decides whether a document appears in the sidebar at all, so it is
     applied optimistically: the row should leave or arrive under the pointer
     that asked for it, not a round trip later. */
  const pinDocument = useCallback(
    async (id, pinned) => {
      setDocs((prev) =>
        prev.map((d) => (d.document_id === id ? { ...d, pinned } : d))
      );
      try {
        await client.patch(`/api/documents/${id}`, { pinned });
        loadDocs();
      } catch {
        loadDocs();
        toast(t("docs.renameFailed"), "err");
      }
    },
    [loadDocs, toast, t]
  );

  const deleteDocument = useCallback(
    async (id) => {
      try {
        await client.delete(`/api/documents/${id}`);
        // A question scoped to a document that no longer exists would be
        // answered from nothing, so the scope goes with it.
        setScopeDocId((cur) => (cur === id ? null : cur));
        loadDocs();
        toast(t("docs.deleted"), "ok");
      } catch {
        toast(t("docs.deleteFailed"), "err");
      }
    },
    [loadDocs, toast, t]
  );

  /* Fetched as a blob because the endpoint wants the bearer token that an
     <a href> cannot carry, then handed to a link that clicks itself. */
  const downloadDocument = useCallback(
    async (d) => {
      try {
        const res = await client.get(`/api/documents/${d.document_id}/file`, {
          responseType: "blob",
        });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = d.original_filename || d.title;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast(t("docs.loadFailed"), "err");
      }
    },
    [toast, t]
  );

  const scopeToDocument = useCallback(
    (d) => {
      setScopeDocId(d.document_id);
      toast(t("docs.scoped", { title: d.title }), "ok");
    },
    [toast, t]
  );

  const clearAllConversations = useCallback(async () => {
    try {
      const { data } = await client.get("/api/conversations");
      await Promise.all(data.map((c) => client.delete(`/api/conversations/${c.conversation_id}`)));
      newChat();
      loadConversations();
      toast("All conversations cleared", "ok");
    } catch {
      toast("Couldn't clear conversations", "err");
    }
  }, [newChat, loadConversations, toast]);

  // Matches the closing animation in CSS; the mode is held open just long
  // enough for it to play.
  const EXIT_MS = 180;

  function togglePrivate() {
    const fresh = () => {
      // Entering or leaving private mode always starts a fresh session.
      setActiveId(null);
      setMessages([]);
    };
    if (privateMode) {
      // Stay in the mode until the closing animation has played, or the class
      // that drives it would be gone before the first frame.
      setPrivateLeaving(true);
      setTimeout(() => {
        setPrivateLeaving(false);
        setPrivateMode(false);
        fresh();
      }, EXIT_MS);
      return;
    }
    setScopeDocId(null);
    setPrivateMode(true);
    fresh();
  }

  const send = useCallback(
    async (text) => {
      const query = (text || "").trim();
      if (!query || sending) return;
      const [provider, model] = sel.split("|");
      setMessages((m) => [...m, { role: "user", content: query, message_id: `u-${idSeq()}` }]);
      setSending(true);
      const replyId = `a-${idSeq()}`;
      const askedAt = Date.now();
      /* The placeholder is only added once the first token lands, so the
         waiting row stays put during retrieval and hands over to real text
         the moment there is some. */
      let started = false;
      let firstTokenMs = 0;
      const startReply = () => {
        started = true;
        // How long the silent part lasted, for the "Thought for Ns" label.
        const thoughtMs = Date.now() - askedAt;
        firstTokenMs = thoughtMs;
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "", message_id: replyId, streaming: true, thoughtMs },
        ]);
      };
      const appendToken = (t) =>
        setMessages((m) => m.map((x) => (x.message_id === replyId ? { ...x, content: x.content + t } : x)));

      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: JSON.stringify({
            query,
            conversation_id: privateMode ? null : activeId,
            provider,
            model,
            incognito: privateMode,
            scope_document_id: scopeDocId || null,
            project_id: activeProjectRef.current,
            language: locale,
          }),
        });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = null;

        for (;;) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          buf += decoder.decode(value, { stream: true });
          // SSE frames are separated by a blank line.
          const frames = buf.split("\n\n");
          buf = frames.pop() || "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6));
            if (typeof payload.t === "string") {
              if (!started) startReply();
              appendToken(payload.t);
            } else if (payload.answer !== undefined) {
              done = payload;
            } else if (payload.message) {
              throw new Error(payload.message);
            }
          }
        }
        if (!done) throw new Error("The answer ended unexpectedly.");

        /* The streamed tokens are raw; the backend cleans the reply only once
           it is complete, so the finished text replaces what was shown. */
        const settled = {
          role: "assistant",
          content: done.answer,
          message_id: replyId,
          thoughtMs: firstTokenMs,
          source_documents: { sources: done.sources || [] },
          meta: {
            provider: done.provider,
            model: done.model,
            ms: done.response_time_ms,
            chunks: done.chunks_retrieved,
            top_score: done.top_score,
          },
        };
        setMessages((m) =>
          started ? m.map((x) => (x.message_id === replyId ? settled : x)) : [...m, settled]
        );
        if (!privateMode) {
          setActiveId(done.conversation_id);
          loadConversations();
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          // Stopped on purpose: keep what arrived and close the message off.
          setMessages((m) =>
            m.map((x) =>
              x.message_id === replyId ? { ...x, streaming: false, stopped: true } : x
            )
          );
          return;
        }
        const detail = err?.friendlyMessage || err?.response?.data?.detail || err.message;
        setMessages((m) => [
          ...m.filter((x) => x.message_id !== replyId),
          { role: "assistant", content: `Error: ${detail}`, message_id: `e-${idSeq()}`, error: true },
        ]);
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [sending, sel, privateMode, activeId, scopeDocId, loadConversations]
  );

  /** Upload a document with pipeline polling; progress surfaced via toasts. */
  const uploadFile = useCallback(
    async (file, projectId = null) => {
      if (!file) return;
      setUploading(true);
      setUploadProgress({ name: file.name, pct: 0 });

      /* One toast for the whole journey, rather than four announcements at
         four different moments. The ring goes round exactly once and never
         backwards: the bytes going up own its first tenth, and the server's
         own 0-100 owns the rest. That split is a weighting -- both halves are
         measured, nothing is estimated -- and it is set low because sending
         the file is the quick part and reading it is not. */
      const UPLOAD_SHARE = 10;
      const tid = progressToast(t("upload.uploading", { name: file.name }));

      const form = new FormData();
      form.append("file", file);
      if (projectId) form.append("project_id", projectId);
      try {
        const { data } = await client.post("/api/documents", form, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            if (!e.total) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress({ name: file.name, pct });
            updateToast(tid, { ring: { pct: (pct * UPLOAD_SHARE) / 100 } });
          },
        });
        // The bytes are in; the server pipeline takes over from here.
        setUploadProgress(null);
        if (projectId) loadProjects();
        loadDocs();

        let d = data;
        let status = d.processing_status;
        for (let i = 0; i < 180 && !["done", "failed"].includes(status); i++) {
          const stage = d.stage || "extracting";
          updateToast(tid, {
            msg: t(STAGE_LABEL[stage] || "upload.processing"),
            /* Whatever the pipeline is actually looking at -- a page number, a
               batch of chunks. It says more than a percentage repeated back. */
            sub: d.stage_detail || "",
            ring: { pct: UPLOAD_SHARE + ((d.progress || 0) * (100 - UPLOAD_SHARE)) / 100 },
          });
          // eslint-disable-next-line no-await-in-loop
          await sleep(2000);
          // eslint-disable-next-line no-await-in-loop
          d = (await client.get(`/api/documents/${data.document_id}`)).data;
          status = d.processing_status;
        }
        loadDocs();

        if (status === "done") {
          settleToast(tid, {
            msg: t("upload.ready"),
            sub: t("chat.chunks", { n: d.chunk_count || 0 }),
            ring: { pct: 100, state: "done" },
          });
        } else if (status === "failed") {
          settleToast(tid, {
            type: "err",
            msg: t("upload.failed", { name: file.name }),
            sub: d.error_message || "",
            ring: { state: "fail" },
          }, 8000);
        } else {
          // Six minutes of polling and still going: stop watching, say so, and
          // leave the document to finish in its own time.
          settleToast(tid, {
            type: "warn",
            msg: t("upload.stillWorking"),
            sub: t("upload.checkLater"),
            ring: { state: "fail" },
          }, 8000);
        }
        return status;
      } catch (err) {
        settleToast(tid, {
          type: "err",
          msg: t("upload.failed", { name: file.name }),
          sub: err?.response?.data?.detail || err.message || "",
          ring: { state: "fail" },
        }, 8000);
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [t, progressToast, updateToast, settleToast, loadDocs, loadProjects]
  );

  /** Cut generation short; the text so far is kept. */
  const stop = useCallback(() => abortRef.current?.abort(), []);

  const value = {
    stop,
    conversations,
    activeId,
    projects,
    activeProjectId,
    activeProject: projects.find((p) => p.project_id === activeProjectId) || null,
    setActiveProject,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    setProjectDocuments,
    messages,
    sending,
    loadingConv,
    privateMode,
    privateLeaving,
    setPrivateMode,
    togglePrivate,
    models,
    sel,
    setSel,
    docs,
    docCount,
    scopeDocId,
    setScopeDocId,
    scopeDoc,
    uploading,
    uploadProgress,
    loadConversations,
    loadDocs,
    renameDocument,
    pinDocument,
    openDoc,
    setOpenDoc,
    deleteDocument,
    downloadDocument,
    scopeToDocument,
    loadModels,
    newChat,
    freshStarts,
    openConversation,
    renameConversation,
    setConversationFlags,
    moveConversation,
    deleteConversation,
    clearAllConversations,
    send,
    uploadFile,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}

// Monotonic id source for message keys (avoids Date.now collisions in a burst).
let _seq = 0;
function idSeq() {
  return ++_seq;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
