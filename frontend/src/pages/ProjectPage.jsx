import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import Tooltip from "../components/Tooltip";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { fmtBytes, timeAgo } from "../utils";

export default function ProjectPage() {
  const { projectId } = useParams();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const project = chat.projects.find((p) => p.project_id === projectId) || null;

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [editingInstr, setEditingInstr] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setInstructions(project.instructions || "");
    }
  }, [project?.project_id, project?.name, project?.instructions]);

  // A project the user just deleted, or one that never existed.
  if (!project) {
    return (
      <div className="page">
        <div className="page-pad">
          <h2 className="page-title">Project not found</h2>
          <p className="page-sub">It may have been deleted.</p>
          <button className="btn btn-outline" onClick={() => navigate("/")}>Back to chat</button>
        </div>
      </div>
    );
  }

  const attached = chat.docs.filter((d) => project.document_ids.includes(d.document_id));
  const chats = chat.conversations.filter((c) => c.project_id === projectId);
  const usingAll = project.doc_scope === "all";

  async function saveName() {
    setEditingName(false);
    const clean = name.trim();
    if (!clean || clean === project.name) { setName(project.name); return; }
    try {
      await chat.updateProject(projectId, { name: clean });
    } catch {
      toast("Couldn't rename the project", "err");
      setName(project.name);
    }
  }

  async function saveInstructions() {
    try {
      await chat.updateProject(projectId, { instructions });
      setEditingInstr(false);
      toast("Instructions saved", "ok");
    } catch {
      toast("Couldn't save the instructions", "err");
    }
  }

  async function detach(documentId) {
    const next = project.document_ids.filter((id) => id !== documentId);
    try {
      await chat.setProjectDocuments(projectId, "selected", next);
    } catch {
      toast("Couldn't remove that document", "err");
    }
  }

  async function onUpload(list) {
    for (const f of Array.from(list || [])) {
      // eslint-disable-next-line no-await-in-loop
      await chat.uploadFile(f, projectId);
    }
  }

  function startChat(text) {
    const q = (text || "").trim();
    if (!q) return;
    chat.newChat(projectId);
    navigate("/");
    chat.send(q);
  }

  async function removeProject() {
    setConfirmDelete(false);
    try {
      await chat.deleteProject(projectId);
      toast("Project deleted", "ok", "Its chats and documents are still here.");
      navigate("/");
    } catch {
      toast("Couldn't delete the project", "err");
    }
  }

  return (
    <div className="page">
      <div className="page-pad">
        <div className="proj-crumb">
          <button className="link-btn" onClick={() => navigate("/")}>Chat</button>
          <span>/</span>
          <span>{project.name}</span>
        </div>

        <div className="proj-title-row">
          {editingName ? (
            <input
              className="input proj-name-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setName(project.name); setEditingName(false); }
              }}
            />
          ) : (
            <h2 className="page-title" onDoubleClick={() => setEditingName(true)}>{project.name}</h2>
          )}
          <div className="proj-title-actions">
            <Tooltip label="Rename project">
              <button className="btn-icon" aria-label="Rename project"
                onClick={() => setEditingName(true)}>
                <Icon name="pencil" className="icon-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Delete project" placement="left">
              <button className="btn-icon" aria-label="Delete project"
                onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" className="icon-sm" />
              </button>
            </Tooltip>
          </div>
        </div>
        <p className="page-sub">
          Chats started here answer only from the documents attached below, using the instructions you set.
        </p>

        <div className="proj-grid">
          <div className="proj-main">
            <div className="proj-composer">
              <textarea
                rows={2}
                placeholder={`Ask something about ${project.name}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    startChat(draft);
                    setDraft("");
                  }
                }}
              />
              <div className="proj-composer-foot">
                <span className="p-sub">
                  {usingAll
                    ? "Searching your whole library"
                    : `${attached.length} document${attached.length === 1 ? "" : "s"} in scope`}
                </span>
                <button className="btn btn-primary" onClick={() => { startChat(draft); setDraft(""); }}>
                  Start chat <Icon name="arrow-r" className="icon-sm" />
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Chats in this project</h3>
                <span className="p-sub">{chats.length}</span>
              </div>
              <div className="panel-body">
                {chats.length === 0 && <p className="page-sub">No chats yet. Ask something above.</p>}
                {chats.map((c) => (
                  <button
                    key={c.conversation_id}
                    className="proj-chat-row"
                    onClick={() => { chat.openConversation(c.conversation_id); navigate("/"); }}
                  >
                    <Icon name="chat" className="icon-sm" />
                    <span className="pc-title">{c.title}</span>
                    <span className="pc-when">{timeAgo(c.updated_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="proj-side">
            <div className="panel">
              <div className="panel-head">
                <h3>Instructions</h3>
                {!editingInstr && (
                  <Tooltip label="Edit instructions" placement="left">
                    <button className="btn-icon" aria-label="Edit instructions"
                      onClick={() => setEditingInstr(true)}>
                      <Icon name="pencil" className="icon-sm" />
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="panel-body">
                {editingInstr ? (
                  <>
                    <textarea
                      className="input proj-instr"
                      rows={7}
                      autoFocus
                      placeholder="You are my HR policy assistant. Answer in short bullet points and always quote the clause number."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                    />
                    <div className="save-row">
                      <button className="btn btn-ghost" onClick={() => { setInstructions(project.instructions || ""); setEditingInstr(false); }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={saveInstructions}>Save</button>
                    </div>
                  </>
                ) : project.instructions ? (
                  <p className="proj-instr-read">{project.instructions}</p>
                ) : (
                  <p className="page-sub">
                    No instructions yet. Add them to tell the model what role to take and how to answer in this project.
                  </p>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Context</h3>
                <Tooltip label="Choose documents" placement="left">
                  <button className="btn-icon" aria-label="Choose documents"
                    onClick={() => setPicking(true)}>
                    <Icon name="plus" className="icon-sm" />
                  </button>
                </Tooltip>
              </div>
              <div className="panel-body">
                {usingAll ? (
                  <p className="page-sub">
                    This project searches your whole library. Choose documents to narrow it.
                  </p>
                ) : attached.length === 0 ? (
                  <p className="page-sub">
                    Nothing attached yet, so this project cannot answer anything. Add a document or upload a new one.
                  </p>
                ) : (
                  attached.map((d) => (
                    <div key={d.document_id} className="ctx-row">
                      <span className={`file-ic ${d.file_type}`}>{d.file_type}</span>
                      <div className="ctx-meta">
                        <div className="ctx-title">{d.title}</div>
                        <div className="ctx-sub">
                          {fmtBytes(d.file_size)}
                          {d.processing_status === "done"
                            ? ` · ${d.chunk_count} chunks`
                            : ` · ${d.processing_status}`}
                        </div>
                      </div>
                      <Tooltip label="Remove from project" placement="left">
                        <button className="btn-icon" aria-label="Remove from project"
                          onClick={() => detach(d.document_id)}>
                          <Icon name="x" className="icon-sm" />
                        </button>
                      </Tooltip>
                    </div>
                  ))
                )}
                <div className="ctx-actions">
                  <button className="btn btn-outline" onClick={() => setPicking(true)}>Choose documents</button>
                  <button className="btn btn-outline" onClick={() => fileRef.current?.click()} disabled={chat.uploading}>
                    Upload here
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    multiple
                    hidden
                    onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }}
                  />
                </div>
                {chat.uploadProgress && (
                  <div className="prog" style={{ marginTop: 12 }}>
                    <div className="prog-track"><span style={{ width: `${chat.uploadProgress.pct}%` }} /></div>
                    <div className="prog-meta">
                      <span>Uploading {chat.uploadProgress.name}</span>
                      <span>{chat.uploadProgress.pct}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <DocPicker
          project={project}
          docs={chat.docs}
          onClose={() => setPicking(false)}
          onSave={async (scope, ids) => {
            try {
              await chat.setProjectDocuments(projectId, scope, ids);
              setPicking(false);
            } catch {
              toast("Couldn't update the document selection", "err");
            }
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this project?"
          text="This removes the project and its instructions. Its chats move back to the main list and its documents stay in your library."
          okLabel="Delete project"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={removeProject}
        />
      )}
    </div>
  );
}

/** Pick the documents a project may retrieve from: all of them, or a chosen set. */
function DocPicker({ project, docs, onClose, onSave }) {
  const [scope, setScope] = useState(project.doc_scope);
  const [selected, setSelected] = useState(() => new Set(project.document_ids));
  const [q, setQ] = useState("");

  const listed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(needle) ||
        d.original_filename.toLowerCase().includes(needle)
    );
  }, [docs, q]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Documents for this project</h3>
          <button className="btn-icon" aria-label="Close" onClick={onClose}><Icon name="x" className="icon-sm" /></button>
        </div>
        <div className="modal-body">
          <div className="scope-choice">
            <label className={`scope-opt ${scope === "all" ? "on" : ""}`}>
              <input type="radio" name="docscope" checked={scope === "all"} onChange={() => setScope("all")} />
              <span>
                <b>My whole library</b>
                <small>Every document you have uploaded, including ones you add later.</small>
              </span>
            </label>
            <label className={`scope-opt ${scope === "selected" ? "on" : ""}`}>
              <input type="radio" name="docscope" checked={scope === "selected"} onChange={() => setScope("selected")} />
              <span>
                <b>Only these documents</b>
                <small>Pick one or several. This project will not look at anything else.</small>
              </span>
            </label>
          </div>

          {scope === "selected" && (
            <>
              <div className="tb-search picker-search">
                <Icon name="search" className="icon-sm" />
                <input
                  type="text"
                  placeholder="Search your documents…"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="picker-list">
                {listed.length === 0 && <p className="page-sub">No documents match.</p>}
                {listed.map((d) => {
                  const usable = d.processing_status === "done";
                  return (
                    <label key={d.document_id} className={`picker-row ${usable ? "" : "muted"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(d.document_id)}
                        onChange={() => toggle(d.document_id)}
                        disabled={!usable}
                      />
                      <span className={`file-ic ${d.file_type}`}>{d.file_type}</span>
                      <span className="pk-meta">
                        <span className="pk-title">{d.title}</span>
                        <span className="pk-sub">
                          {usable ? `${d.chunk_count} chunks` : `${d.processing_status} - not searchable yet`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div className="save-row spread">
            <span className="p-sub">
              {scope === "all" ? "Whole library" : `${selected.size} selected`}
            </span>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onSave(scope, Array.from(selected))}>
              Save selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
