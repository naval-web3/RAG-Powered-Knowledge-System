import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Composer from "../components/Composer";
import ContextDialog from "../components/ContextDialog";
import { DocCard, SelectionBar, useSelection } from "../components/DocSelect";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import Tooltip from "../components/Tooltip";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import client from "../api/client";
import { timeAgo } from "../utils";

/* Whatever actually went wrong, in the toast's second line. A bare "couldn't
   do that" is unactionable, and the server already sends a reason. */
const why = (err) =>
  err?.response?.data?.detail || err?.friendlyMessage || err?.message || undefined;

/* A project is a working set, not an archive: past a couple of thousand
   chunks a retrieval of five starts competing with itself and answers get
   vaguer. Nothing in the backend rejects the 2001st chunk -- this is a design
   limit, not an enforced one -- so the bar is guidance and says out loud what
   it is counting. */
const CHUNK_BUDGET = 2000;

/* Module scope so its identity never changes: passing a fresh arrow on every
   render would make the selection recompute its id list every time. */
const docId = (d) => d.document_id;

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

  const [editingInstr, setEditingInstr] = useState(false);
  // The instructions are clamped to two lines at rest, as they are the longest
  // thing on the card and the least often re-read.
  const [instrOpen, setInstrOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reading, setReading] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  /* Above the early return for the same reason the selection is: hooks are
     counted in order, and a project that has not loaded yet would take the
     branch below on the first render and call one more hook on the second. */
  const touch = chat.touchProject;
  useEffect(() => {
    if (projectId) touch(projectId);
  }, [projectId, touch]);

  /* Above the early return, and guarded, because it is a hook: React counts
     them in order and a project that has not loaded yet would take the branch
     below on the first render and then call one MORE hook on the second. */
  const attached = project
    ? chat.docs.filter((d) => project.document_ids.includes(d.document_id))
    : [];
  const sel = useSelection(attached, docId);

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

  const chats = chat.conversations.filter((c) => c.project_id === projectId);
  const usingAll = project.doc_scope === "all";

  /* A project set to the whole library really can reach every indexed document,
     so that is what its capacity counts. Chunks, not files: a 400-page report
     and a one-page note are not the same amount of project. */
  const inScope = usingAll
    ? chat.docs.filter((d) => d.processing_status === "done")
    : attached;
  const chunks = inScope.reduce((n, d) => n + (d.chunk_count || 0), 0);
  const pct = Math.min(100, Math.round((chunks / CHUNK_BUDGET) * 100));
  const capLevel = chunks >= CHUNK_BUDGET ? "over" : chunks >= CHUNK_BUDGET * 0.9 ? "near" : "";

  /* Two verbs, because in a project they are genuinely different acts. Taking
     a document out of a project leaves it in the library and in every other
     project; deleting it takes the file and its vectors with it. */
  async function detachSelected() {
    const drop = sel.picked;
    const next = project.document_ids.filter((id) => !drop.has(id));
    const n = drop.size;
    try {
      await chat.setProjectDocuments(projectId, "selected", next);
      sel.clear();
      toast(
        n === 1 ? "Removed from this project" : `${n} removed from this project`,
        "ok",
        n === 1 ? "It is still in your library." : "They are still in your library."
      );
    } catch (err) {
      toast("Couldn't remove those documents", "err", why(err));
    }
  }

  async function deleteSelected() {
    const ids = [...sel.picked];
    setConfirmWipe(false);
    try {
      await Promise.all(ids.map((id) => client.delete(`/api/documents/${id}`)));
      sel.clear();
      chat.loadDocs();
      chat.loadProjects();
      toast(ids.length === 1 ? "Document deleted" : `${ids.length} documents deleted`, "ok");
    } catch (err) {
      chat.loadDocs();
      toast("Couldn't delete those documents", "err", why(err));
    }
  }

  async function saveInstructions(instructions) {
    try {
      await chat.updateProject(projectId, { instructions });
      setEditingInstr(false);
      toast("Instructions saved", "ok");
    } catch (err) {
      toast("Couldn't save the instructions", "err", why(err));
    }
  }

  async function detach(documentId) {
    const next = project.document_ids.filter((id) => id !== documentId);
    try {
      await chat.setProjectDocuments(projectId, "selected", next);
    } catch (err) {
      toast("Couldn't remove that document", "err", why(err));
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
    } catch (err) {
      toast("Couldn't change the pin", "err", why(err));
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
    } catch (err) {
      toast("Couldn't delete the project", "err", why(err));
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
            <button className="btn btn-outline" onClick={share}>Share</button>
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
                <Tooltip label="Set project instructions" placement="left">
                  <button className="btn-icon" aria-label="Set project instructions"
                    onClick={() => setEditingInstr(true)}>
                    <Icon name="pencil" className="icon-sm" />
                  </button>
                </Tooltip>
              </div>
              {project.instructions ? (
                /* Clamped at rest and opened by a click, rather than by a
                   second control: the text itself is the only thing there is
                   to press, and nothing else on the card wants that click.
                   Editing is a dialog now -- standing instructions run to
                   paragraphs, and a seven-row box wedged into a sidebar card
                   is the wrong shape to write them in. */
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
                <button className="proj-sec-add" onClick={() => setEditingInstr(true)}>
                  Tell the model what role to take here and how to answer.
                </button>
              )}
            </section>

            <section className="proj-sec">
              {/* Not space-between: with a heading and TWO controls that parks
                  the first one mid-row. The heading takes the slack instead. */}
              <div className="proj-sec-head">
                <h3>Context</h3>
                {inScope.length > 0 && (
                  <Tooltip label="Browse context" placement="top">
                    <button className="btn-icon" aria-label="Browse context"
                      aria-haspopup="dialog" onClick={() => setReading(true)}>
                      <Icon name="search" className="icon-sm" />
                    </button>
                  </Tooltip>
                )}
                <ContextMenu
                  onChoose={() => setPicking(true)}
                  onUpload={() => fileRef.current?.click()}
                  busy={chat.uploading}
                />
              </div>

              {/* Nothing to measure yet reads better as no bar at all than as an
                  empty one, which looks like a project that has gone wrong. */}
              {chunks > 0 && (
                <div className={`cap ${capLevel}`}>
                  <div className="cap-track">
                    <span style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                  <div className="cap-label">{pct}% of project capacity used</div>
                </div>
              )}

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
                <>
                  <SelectionBar open={sel.some} count={sel.count} all={sel.all}
                    onToggleAll={sel.toggleAll} onClear={sel.clear}>
                    {/* Remove first and delete second, in that order and with
                        only one of them coloured: they sit a few pixels apart
                        and one of them cannot be undone. */}
                    <button className="btn btn-sm" onClick={detachSelected}>
                      Remove
                    </button>
                    <button className="btn btn-sm sel-danger" onClick={() => setConfirmWipe(true)}>
                      <Icon name="trash" className="icon-sm" /> Delete
                    </button>
                  </SelectionBar>
                  <div className="doc-grid ctx-grid">
                    {attached.map((d) => (
                      <DocCard
                        key={d.document_id}
                        doc={d}
                        selecting={sel.some}
                        selected={sel.picked.has(d.document_id)}
                        onToggle={sel.toggle}
                        onOpen={() => chat.setOpenDoc(d)}
                        onRemove={() => detach(d.document_id)}
                        removeLabel="Remove from project"
                      />
                    ))}
                  </div>
                </>
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

      {reading && (
        <ContextDialog docs={inScope} onClose={() => setReading(false)} />
      )}

      {editingInstr && (
        <InstructionsModal
          project={project}
          onClose={() => setEditingInstr(false)}
          onSave={saveInstructions}
        />
      )}

      {editing && (
        <EditDetails
          project={project}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            try {
              await chat.updateProject(projectId, patch);
              setEditing(false);
              toast("Project updated", "ok");
            } catch (err) {
              toast("Couldn't save those details", "err", why(err));
            }
          }}
        />
      )}

      {picking && (
        <DocPicker
          project={project}
          docs={chat.docs}
          onClose={() => setPicking(false)}
          onSave={async (ids) => {
            try {
              await chat.setProjectDocuments(projectId, "selected", ids);
              setPicking(false);
            } catch (err) {
              toast("Couldn't update the document selection", "err", why(err));
            }
          }}
        />
      )}

      {confirmWipe && (
        <ConfirmModal
          title={`Delete ${sel.count} document${sel.count === 1 ? "" : "s"}?`}
          text="This removes the files and everything indexed from them, from this project and from your library. It cannot be undone."
          okLabel="Delete"
          onCancel={() => setConfirmWipe(false)}
          onConfirm={deleteSelected}
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

/* Instructions deliberately do NOT appear here as well. They have their own
   dialog, and two routes to one field means two drafts of it open at once. */
function EditDetails({ project, onClose, onSave }) {
  const [name, setName] = useState(project.name);
  const clean = name.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
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
              onKeyDown={(e) => { if (e.key === "Enter" && clean) onSave({ name: clean }); }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!clean}
            onClick={() => onSave({ name: clean })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Standing instructions, full width and full height.
 *
 * These are the longest thing anyone writes in this app and the one most worth
 * re-reading before saving, which is why they get a dialog of their own rather
 * than a box in the corner of a card.
 */
function InstructionsModal({ project, onClose, onSave }) {
  const [text, setText] = useState(project.instructions || "");
  const dirty = text !== (project.instructions || "");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal instr-modal" role="dialog" aria-modal="true"
        aria-labelledby="instr-title"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 id="instr-title">Set project instructions</h3>
        </div>
        <div className="modal-body">
          {/* Both halves of this are true of the engine: the project's
              instructions and the ones on your own account are put into the
              same prompt, and what they are applied to is whatever the
              retrieval pulls out of the documents in Context. */}
          <p className="m-text instr-sub">
            Standing instructions for every chat in <b>{project.name}</b> — the role to
            take, and how to answer. They work alongside your own instructions in
            Settings, and apply to whatever this project retrieves from the documents
            in Context.
          </p>
          <textarea className="input instr-box" autoFocus value={text}
            placeholder="You are my HR policy assistant. Answer in short bullet points and always quote the clause number."
            onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!dirty} onClick={() => onSave(text)}>
            Save instructions
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Which documents this project may read.
 *
 * A flat multi-select: search, tick, save. It used to open on a pair of radios
 * offering "my whole library" as a mode of its own, which asked a question
 * before the one the dialog is actually for -- so a project opened on that
 * setting arrives here with every document already ticked, which is what the
 * setting meant anyway.
 */
function DocPicker({ project, docs, onClose, onSave }) {
  const ready = useMemo(
    () => docs.filter((d) => d.processing_status === "done"),
    [docs]
  );
  /* A project on the old whole-library scope keeps no links at all, so seeding
     from document_ids would open the dialog looking empty and quietly detach
     everything on save. Seed it with what the project can currently read. */
  const [selected, setSelected] = useState(() =>
    project.doc_scope === "all"
      ? new Set(ready.map((d) => d.document_id))
      : new Set(project.document_ids)
  );
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

  /* Select all acts on what the search has left showing, not on the library.
     Filtering to "invoice" and ticking the box should tick the invoices. */
  const selectable = listed.filter((d) => d.processing_status === "done");
  const allShown = selectable.length > 0 && selectable.every((d) => selected.has(d.document_id));
  const someShown = selectable.some((d) => selected.has(d.document_id));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectable.forEach((d) => {
        if (allShown) next.delete(d.document_id);
        else next.add(d.document_id);
      });
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg pick-modal" role="dialog" aria-modal="true"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Documents for this project</h3>
          <button className="btn-icon" aria-label="Close" onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>

        <div className="pick-tools">
          <label className="pick-search">
            <Icon name="search" className="icon-sm" />
            <input
              type="text"
              autoFocus
              placeholder="Search your documents…"
              aria-label="Search your documents"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className={`pick-all ${selectable.length === 0 ? "is-off" : ""}`}>
            <input
              type="checkbox"
              checked={allShown}
              disabled={selectable.length === 0}
              /* Partly ticked is a property, not an attribute: React cannot
                 set it from JSX, so it is written on the node itself. */
              ref={(el) => { if (el) el.indeterminate = !allShown && someShown; }}
              onChange={toggleAll}
            />
            <span>Select all</span>
          </label>
        </div>

        <div className="pick-list">
          {listed.length === 0 && (
            <p className="pick-empty">
              {q.trim() ? `No document matches “${q.trim()}”.` : "Your library is empty."}
            </p>
          )}
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
                    {usable ? `${d.chunk_count} chunks` : `${d.processing_status} — not searchable yet`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="modal-foot pick-foot">
          <span className="pick-count">
            {selected.size === 0 ? (
              "Nothing selected"
            ) : (
              <><b>{selected.size}</b> of {docs.length} selected</>
            )}
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(Array.from(selected))}>
            Save selection
          </button>
        </div>
      </div>
    </div>
  );
}
