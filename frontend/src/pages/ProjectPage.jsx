import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Composer from "../components/Composer";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import Tooltip from "../components/Tooltip";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { fmtBytes, timeAgo } from "../utils";

/**
 * Inside one project: ask it something, see what has been asked before, and
 * keep the two things that make it a project rather than a folder -- the
 * standing instructions, and the documents it is allowed to read.
 *
 * The composer here is the same component the chat page docks at its foot, so
 * a question started from a project is typed into exactly the box it will be
 * answered in. Its retrieval-scope menu is left off: the project already
 * answers that question, and offering it twice would let the two disagree.
 */
export default function ProjectPage() {
  const { projectId } = useParams();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const project = chat.projects.find((p) => p.project_id === projectId) || null;

  const [instructions, setInstructions] = useState("");
  const [editingInstr, setEditingInstr] = useState(false);
  // The instructions are clamped to two lines at rest, as they are the longest
  // thing on the card and the least often re-read.
  const [instrOpen, setInstrOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (project) setInstructions(project.instructions || "");
  }, [project?.project_id, project?.instructions]);

  // A project the user just deleted, or one that never existed.
  if (!project) {
    return (
      <div className="page">
        <div className="page-pad">
          <h2 className="page-title">Project not found</h2>
          <p className="page-sub">It may have been deleted.</p>
          <button className="btn btn-outline" onClick={() => navigate("/projects")}>
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  const attached = chat.docs.filter((d) => project.document_ids.includes(d.document_id));
  const chats = chat.conversations.filter((c) => c.project_id === projectId);
  const usingAll = project.doc_scope === "all";

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

  /* A question asked here belongs to this project, so the chat is opened under
     it before the text is handed over. */
  function startChat(text) {
    const q = (text || "").trim();
    if (!q) return;
    chat.newChat(projectId);
    navigate("/");
    chat.send(q);
  }

  async function togglePin() {
    try {
      await chat.updateProject(projectId, { pinned: !project.pinned });
    } catch {
      toast("Couldn't change the pin", "err");
    }
  }

  /* There is no sharing backend, so Share does the one honest thing a single
     user can do with a project: hand them its address. */
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied", "ok", "It opens this project on your own account.");
    } catch {
      toast("Couldn't copy the link", "err");
    }
  }

  async function removeProject() {
    setConfirmDelete(false);
    try {
      await chat.deleteProject(projectId);
      toast("Project deleted", "ok", "Its chats and documents are still here.");
      navigate("/projects");
    } catch {
      toast("Couldn't delete the project", "err");
    }
  }

  return (
    <div className="page">
      <div className="page-pad proj-pad">
        <nav className="proj-crumb" aria-label="Breadcrumb">
          <button className="link-btn" onClick={() => navigate("/projects")}>Projects</button>
          <span aria-hidden="true">/</span>
          <span className="crumb-here">{project.name}</span>
        </nav>

        <div className="proj-head">
          <h1 className="proj-title">{project.name}</h1>
          <div className="proj-actions">
            <Tooltip label={project.pinned ? "Unpin project" : "Pin project"}>
              <button className={`btn-icon proj-pin ${project.pinned ? "on" : ""}`}
                aria-pressed={!!project.pinned}
                aria-label={project.pinned ? "Unpin project" : "Pin project"}
                onClick={togglePin}>
                <Icon name="pin" className="icon-sm" />
              </button>
            </Tooltip>
            <button className="btn btn-outline btn-sm" onClick={share}>Share</button>
            <ProjectMenu
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>

        <div className="proj-grid">
          <div className="proj-main">
            <Composer
              className="inline"
              fileRef={fileRef}
              rotate={false}
              scope={false}
              placeholder="How can I help you today?"
              onSubmit={startChat}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              multiple
              hidden
              onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }}
            />

            <h2 className="proj-recents-label">Recents</h2>
            {chats.length === 0 ? (
              <p className="proj-recents-empty">
                Nothing asked here yet. The chats you start in this project collect below.
              </p>
            ) : (
              <div className="proj-recents">
                {chats.map((c) => (
                  <button
                    key={c.conversation_id}
                    className="proj-recent"
                    onClick={() => { chat.openConversation(c.conversation_id); navigate("/"); }}
                  >
                    <span className="pr-title">{c.title}</span>
                    <span className="pr-when">{timeAgo(c.updated_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="proj-card">
            <section className="proj-sec">
              <div className="proj-sec-head">
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
                    <button className="btn btn-ghost" onClick={() => {
                      setInstructions(project.instructions || "");
                      setEditingInstr(false);
                    }}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={saveInstructions}>Save</button>
                  </div>
                </>
              ) : project.instructions ? (
                /* Clamped at rest and opened by a click, rather than by a
                   second control: the text itself is the only thing there is
                   to press, and nothing else on the card wants that click. */
                <p className={`proj-sec-text clampable ${instrOpen ? "open" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={instrOpen ? "Collapse" : "Show all"}
                  onClick={() => setInstrOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setInstrOpen((o) => !o);
                    }
                  }}>
                  {project.instructions}
                </p>
              ) : (
                <p className="proj-sec-text muted">
                  Tell the model what role to take here and how to answer.
                </p>
              )}
            </section>

            <section className="proj-sec">
              <div className="proj-sec-head">
                <h3>Context</h3>
                <ContextMenu
                  onChoose={() => setPicking(true)}
                  onUpload={() => fileRef.current?.click()}
                  busy={chat.uploading}
                />
              </div>

              {usingAll ? (
                <p className="proj-sec-text muted">
                  This project reads your whole library. Choose documents to narrow it.
                </p>
              ) : attached.length === 0 ? (
                <button className="ctx-empty" onClick={() => setPicking(true)}>
                  {/* Two files rather than one drawing that follows currentColor:
                      the art is a shaded illustration, not an icon, and its
                      paper and shadows do not survive being recoloured. */}
                  <img className="ctx-art light" src="/project-context-light.svg"
                    alt="" width="210" height="112" />
                  <img className="ctx-art dark" src="/project-context-dark.svg"
                    alt="" width="210" height="112" />
                  <span>Add PDFs, documents, or other text to reference in this project.</span>
                </button>
              ) : (
                <div className="ctx-list">
                  {attached.map((d) => (
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
                  ))}
                </div>
              )}

              {chat.uploadProgress && (
                <div className="prog" style={{ marginTop: 12 }}>
                  <div className="prog-track"><span style={{ width: `${chat.uploadProgress.pct}%` }} /></div>
                  <div className="prog-meta">
                    <span>Uploading {chat.uploadProgress.name}</span>
                    <span>{chat.uploadProgress.pct}%</span>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {editing && (
        <EditDetails
          project={project}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            try {
              await chat.updateProject(projectId, patch);
              setEditing(false);
              toast("Project updated", "ok");
            } catch {
              toast("Couldn't save those details", "err");
            }
          }}
        />
      )}

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

/** A menu that closes on any click outside itself. */
function useDismiss(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

/** The ⋮ beside the title: everything you can do to the project as a whole. */
function ProjectMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="menu-anchor" ref={ref}>
      <button className="btn-icon" aria-haspopup="true" aria-expanded={open}
        aria-label="Project actions" onClick={() => setOpen((o) => !o)}>
        <Icon name="more-v" className="icon-sm" />
      </button>
      {open && (
        <div className="pop-menu pm-drop">
          <button className="pm-item" onClick={() => { setOpen(false); onEdit(); }}>
            <Icon name="pencil" className="icon-sm" /> Edit details
          </button>
          <div className="pm-sep" />
          <button className="pm-item danger" onClick={() => { setOpen(false); onDelete(); }}>
            <Icon name="trash" className="icon-sm" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* A plus on the Context header reads as "add something to this", which is two
   different actions here: point at what is already in the library, or put
   something new in it. */
function ContextMenu({ onChoose, onUpload, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="menu-anchor" ref={ref}>
      <Tooltip label={busy ? "Uploading…" : "Add context"} placement="left">
        <button className="btn-icon" aria-haspopup="true" aria-expanded={open}
          aria-label="Add context" disabled={busy}
          onClick={() => setOpen((o) => !o)}>
          <Icon name={busy ? "refresh" : "plus"} className="icon-sm" />
        </button>
      </Tooltip>
      {open && (
        <div className="pop-menu pm-drop">
          <button className="pm-item" onClick={() => { setOpen(false); onChoose(); }}>
            <Icon name="search" className="icon-sm" /> Choose from library
          </button>
          <button className="pm-item" onClick={() => { setOpen(false); onUpload(); }}>
            <Icon name="upload" className="icon-sm" /> Upload files
          </button>
        </div>
      )}
    </div>
  );
}

/** Name and standing instructions, the two things that describe a project. */
function EditDetails({ project, onClose, onSave }) {
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions || "");
  const clean = name.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Project details</h3>
          <button className="btn-icon" aria-label="Close" onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="proj-name">Name</label>
            <input id="proj-name" className="input" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && clean) onSave({ name: clean, instructions }); }} />
          </div>
          <div className="field">
            <label htmlFor="proj-instructions">Instructions</label>
            <textarea id="proj-instructions" className="input proj-instr" rows={6} value={instructions}
              placeholder="You are my HR policy assistant. Answer in short bullet points and always quote the clause number."
              onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="save-row">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!clean}
              onClick={() => onSave({ name: clean, instructions })}>
              Save
            </button>
          </div>
        </div>
      </div>
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
