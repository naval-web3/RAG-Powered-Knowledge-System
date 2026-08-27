import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useToast } from "./ToastContext";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { toast } = useToast();

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
  const [loadingConv, setLoadingConv] = useState(false);

  const [privateMode, setPrivateMode] = useState(false);

  const [models, setModels] = useState({ ollama: [], openai: [], openai_enabled: false });
  const [sel, setSel] = useState("ollama|llama3.2:3b");

  const [docs, setDocs] = useState([]);
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

  useEffect(() => {
    loadConversations();
    loadDocs();
    loadModels();
    loadProjects();
  }, [loadConversations, loadDocs, loadModels, loadProjects]);

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
    },
    [setActiveProject]
  );

  const openConversation = useCallback(
    async (id) => {
      if (privateMode) setPrivateMode(false);
      setLoadingConv(true);
      try {
        const { data } = await client.get(`/api/conversations/${id}`);
        setActiveId(id);
        setActiveProject(data.project_id || null);
        setMessages(data.messages || []);
      } catch {
        toast("Couldn't open that conversation.", "err");
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
      try {
        await client.patch(`/api/conversations/${id}`, { title: clean });
        loadConversations();
      } catch {
        toast("Rename failed.", "err");
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
        toast("Conversation deleted.", "ok");
      } catch {
        toast("Delete failed.", "err");
      }
    },
    [activeId, newChat, loadConversations, toast]
  );

  const clearAllConversations = useCallback(async () => {
    try {
      const { data } = await client.get("/api/conversations");
      await Promise.all(data.map((c) => client.delete(`/api/conversations/${c.conversation_id}`)));
      newChat();
      loadConversations();
      toast("All conversations cleared.", "ok");
    } catch {
      toast("Couldn't clear conversations.", "err");
    }
  }, [newChat, loadConversations, toast]);

  function togglePrivate() {
    setPrivateMode((p) => {
      const next = !p;
      // Entering or leaving private mode always starts a fresh session.
      setActiveId(null);
      setMessages([]);
      if (next) setScopeDocId(null);
      return next;
    });
  }

  const send = useCallback(
    async (text) => {
      const query = (text || "").trim();
      if (!query || sending) return;
      const [provider, model] = sel.split("|");
      setMessages((m) => [...m, { role: "user", content: query, message_id: `u-${idSeq()}` }]);
      setSending(true);
      try {
        const { data } = await client.post("/api/chat", {
          query,
          conversation_id: privateMode ? null : activeId,
          provider,
          model,
          incognito: privateMode,
          scope_document_id: scopeDocId || null,
          project_id: activeProjectRef.current,
        });
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.answer,
            message_id: `a-${idSeq()}`,
            source_documents: { sources: data.sources || [] },
            meta: {
              provider: data.provider,
              model: data.model,
              ms: data.response_time_ms,
              chunks: data.chunks_retrieved,
              top_score: data.top_score,
            },
          },
        ]);
        if (!privateMode) {
          setActiveId(data.conversation_id);
          loadConversations();
        }
      } catch (err) {
        const detail = err?.friendlyMessage || err?.response?.data?.detail || err.message;
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Error: ${detail}`, message_id: `e-${idSeq()}`, error: true },
        ]);
      } finally {
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
      const tid = toast(`Uploading “${file.name}”…`, "info");
      const form = new FormData();
      form.append("file", file);
      if (projectId) form.append("project_id", projectId);
      try {
        const { data } = await client.post("/api/documents", form, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            if (!e.total) return;
            setUploadProgress({ name: file.name, pct: Math.round((e.loaded / e.total) * 100) });
          },
        });
        // The bytes are in; the server pipeline takes over from here.
        setUploadProgress(null);
        if (projectId) loadProjects();
        loadDocs();
        let status = data.processing_status;
        let reason = "";
        let ocrNotified = false;
        for (let i = 0; i < 180 && !["done", "failed"].includes(status); i++) {
          await sleep(2000);
          const d = (await client.get(`/api/documents/${data.document_id}`)).data;
          status = d.processing_status;
          reason = d.error_message || "";
          if (status === "ocr" && !ocrNotified) {
            ocrNotified = true;
            toast(`“${file.name}” looks scanned — running OCR to read it.`, "info", "This can take a few minutes.");
          }
        }
        loadDocs();
        if (status === "done") {
          toast(`“${file.name}” is ready.`, "ok", "Ask a question about it.");
        } else if (status === "failed") {
          toast(`“${file.name}” could not be processed.`, "err", reason);
        } else {
          toast(`“${file.name}” is still processing.`, "warn", "Check the Documents tab shortly.");
        }
        return status;
      } catch (err) {
        toast("Upload failed", "err", err?.response?.data?.detail || err.message);
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [toast, loadDocs, loadProjects]
  );

  const value = {
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
    loadModels,
    newChat,
    openConversation,
    renameConversation,
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
