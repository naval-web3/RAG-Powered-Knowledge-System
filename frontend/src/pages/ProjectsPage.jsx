import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import LibraryShell, {
  useLibrary, byDateDesc, byName,
} from "../components/LibraryShell";
import Tooltip from "../components/Tooltip";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import { timeAgo } from "../utils";

/**
 * Every project. The sidebar keeps the pinned few; this is the rest of them,
 * and where new ones are started.
 */
export default function ProjectsPage() {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  /* When the project itself was last written -- renamed, re-scoped, given new
     instructions -- says nothing about when it was last USED. Chatting inside
     a project deliberately does not touch the project row, and opening one is
     recorded separately, so the last interaction is the latest of three: when
     the project was written, when it was opened, and the newest chat in it. */
  const lastChatIn = useMemo(() => {
    const m = new Map();
    for (const c of chat.conversations) {
      if (!c.project_id) continue;
      const seen = m.get(c.project_id);
      if (!seen || new Date(c.updated_at) > new Date(seen)) m.set(c.project_id, c.updated_at);
    }
    return m;
  }, [chat.conversations]);

  const lastTouched = useCallback(
    (p) => {
      const times = [p.updated_at, p.last_opened_at, lastChatIn.get(p.project_id)].filter(Boolean);
      return times.reduce((a, b) => (new Date(b) > new Date(a) ? b : a));
    },
    [lastChatIn]
  );

  /* A project has both dates and they answer different questions: which one
     did I touch last, and which one did I start first. */
  const sorts = useMemo(
    () => [
      { value: "recent", label: t("common.sortRecent"), nameOf: (p) => p.name, cmp: byDateDesc(lastTouched) },
      { value: "created", label: t("common.sortCreated"), nameOf: (p) => p.name, cmp: byDateDesc((p) => p.created_at) },
      { value: "name", label: t("common.sortAlpha"), nameOf: (p) => p.name, cmp: byName((p) => p.name) },
    ],
    [t, lastTouched]
  );
  const { q, setQ, sort, setSort, shown } = useLibrary(chat.projects, sorts);

  async function create() {
    const clean = name.trim();
    setCreating(false);
    setName("");
    if (!clean) return;
    const project = await chat.createProject(clean);
    // Straight into the project that was just made: creating one is always the
    // start of working in it.
    if (project) navigate(`/projects/${project.project_id}`);
  }

  async function removeProject() {
    const p = deleting;
    setDeleting(null);
    try {
      await chat.deleteProject(p.project_id);
      toast(t("projects.deleted"), "ok", t("projects.deleteText"));
    } catch (err) {
      toast(t("projects.deleteFailed"), "err", err?.response?.data?.detail || "");
    }
  }

  return (
    <LibraryShell
      title={t("sidebar.projects")}
      q={q} setQ={setQ} sort={sort} setSort={setSort} sorts={sorts}
      searchLabel={t("sidebar.searchProjects")}
      action={
        <button className="btn btn-primary"
          onClick={() => { setCreating(true); setName(""); }}>
          <Icon name="plus" className="icon-sm" /> {t("sidebar.newProject")}
        </button>
      }
    >
      {creating && (
        <input className="lib-new" autoFocus value={name}
          placeholder={t("sidebar.projectName")} aria-label={t("sidebar.projectName")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") { setCreating(false); setName(""); }
          }}
          onBlur={create} />
      )}

      {shown.length === 0 ? (
        <div className="lib-empty">
          {q.trim() ? t("sidebar.nothingMatches", { q: q.trim() }) : t("sidebar.noProjects")}
        </div>
      ) : (
        <div className="lib-grid">
          {shown.map((p) => (
            <button key={p.project_id} className="lib-card"
              onClick={() => navigate(`/projects/${p.project_id}`)}>
              <div className="lib-card-top">
                <span className="lib-card-name">{p.name}</span>
                {/* Pinned is worth seeing without hovering; it is why the
                    project is at the top of the list. The menu is not. */}
                {p.pinned && (
                  <span className="lib-pinned" aria-label={t("common.unpin")}>
                    <Icon name="pin" className="icon-sm" />
                  </span>
                )}
                <CardMenu
                  project={p}
                  onPin={() => chat.updateProject(p.project_id, { pinned: !p.pinned })}
                  onEdit={() => setEditing(p)}
                  onDelete={() => setDeleting(p)}
                />
              </div>
              {/* The standing instructions are what one project is actually
                  told apart from another by, so they stand in as the blurb. */}
              {p.instructions && <p className="lib-card-body">{p.instructions}</p>}
              <div className="lib-card-foot">
                {/* The last time this project was used, not the last time
                    its settings were written. */}
                <span className="lib-date">{timeAgo(lastTouched(p))}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <EditDetails
          project={editing}
          onClose={() => setEditing(null)}
          onSave={async (clean) => {
            const p = editing;
            setEditing(null);
            try {
              await chat.updateProject(p.project_id, { name: clean });
            } catch (err) {
              toast(t("projects.deleteFailed"), "err", err?.response?.data?.detail || "");
            }
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={t("projects.deleteTitle")}
          text={t("projects.deleteText")}
          okLabel={t("common.delete")}
          onCancel={() => setDeleting(null)}
          onConfirm={removeProject}
        />
      )}
    </LibraryShell>
  );
}

/**
 * The ⋮ in the corner of a project card.
 *
 * Everything you can do to a project without opening it, in one place, quiet
 * until the card is under the pointer. Each item stops the click reaching the
 * card underneath: choosing "Delete" from a menu is not asking to open the
 * thing you are deleting.
 */
function CardMenu({ project, onPin, onEdit, onDelete }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <span className="menu-anchor lib-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <Tooltip label={t("projects.options")} placement="top">
        <button className={`lib-act ${open ? "on" : ""}`} aria-haspopup="true"
          aria-expanded={open} aria-label={t("projects.options")}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
          <Icon name="more-v" className="icon-sm" />
        </button>
      </Tooltip>
      {open && (
        <div className="pop-menu pm-drop">
          <button className="pm-item" onClick={pick(onPin)}>
            <Icon name={project.pinned ? "pin-off" : "pin"} className="icon-sm" />
            {project.pinned ? t("common.unpin") : t("common.pin")}
          </button>
          <button className="pm-item" onClick={pick(onEdit)}>
            <Icon name="pencil" className="icon-sm" /> {t("projects.editDetails")}
          </button>
          <div className="pm-sep" />
          <button className="pm-item danger" onClick={pick(onDelete)}>
            <Icon name="trash" className="icon-sm" /> {t("common.delete")}
          </button>
        </div>
      )}
    </span>
  );
}

/** The one thing a project is described by from this page: its name. */
function EditDetails({ project, onClose, onSave }) {
  const t = useT();
  const [name, setName] = useState(project.name);
  const clean = name.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("projects.editDetails")}</h3>
          <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="proj-rename">{t("sidebar.projectName")}</label>
            <input id="proj-rename" className="input" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && clean) onSave(clean); }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!clean} onClick={() => onSave(clean)}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
