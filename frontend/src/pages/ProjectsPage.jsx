import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import NewProjectDialog from "../components/NewProjectDialog";
import { ProjectMenu, EditProjectDialog } from "../components/ProjectMenu";
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

  async function create(clean, about) {
    setCreating(false);
    const project = await chat.createProject(clean, about);
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
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" className="icon-sm" /> {t("sidebar.newProject")}
        </button>
      }
    >
      {creating && (
        <NewProjectDialog onClose={() => setCreating(false)} onCreate={create} />
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
                <ProjectMenu
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
        <EditProjectDialog
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
