import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import LibraryShell, {
  useLibrary, PinButton, byDateDesc, byName,
} from "../components/LibraryShell";
import { useChat } from "../context/ChatContext";
import { useT } from "../i18n";
import { timeAgo } from "../utils";

/**
 * Every project. The sidebar keeps the pinned few; this is the rest of them,
 * and where new ones are started.
 */
export default function ProjectsPage() {
  const t = useT();
  const chat = useChat();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  /* A project has both dates and they answer different questions: which one
     did I touch last, and which one did I start first. */
  const sorts = useMemo(
    () => [
      { value: "recent", label: t("common.sortRecent"), nameOf: (p) => p.name, cmp: byDateDesc((p) => p.updated_at) },
      { value: "created", label: t("common.sortCreated"), nameOf: (p) => p.name, cmp: byDateDesc((p) => p.created_at) },
      { value: "name", label: t("common.sortAlpha"), nameOf: (p) => p.name, cmp: byName((p) => p.name) },
    ],
    [t]
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
                <PinButton
                  pinned={!!p.pinned}
                  label={p.pinned ? t("common.unpin") : t("common.pin")}
                  onToggle={() => chat.updateProject(p.project_id, { pinned: !p.pinned })}
                />
              </div>
              {/* The standing instructions are what one project is actually
                  told apart from another by, so they stand in as the blurb. */}
              {p.instructions && <p className="lib-card-body">{p.instructions}</p>}
              <div className="lib-card-foot">
                <span className="lib-date">{timeAgo(p.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </LibraryShell>
  );
}
