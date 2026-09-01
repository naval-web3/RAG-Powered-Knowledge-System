import { useCallback, useMemo, useState } from "react";
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
  /* When the project itself was last written -- renamed, re-scoped, given new
     instructions -- says nothing about when it was last USED. Chatting inside
     a project deliberately does not touch the project row, so a project worked
     in all morning still reported the day its documents were chosen.
     The last interaction is the later of the two: the project's own timestamp,
     or the newest chat filed under it. */
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
      const chatted = lastChatIn.get(p.project_id);
      return chatted && new Date(chatted) > new Date(p.updated_at) ? chatted : p.updated_at;
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
                {/* The last time this project was used, not the last time
                    its settings were written. */}
                <span className="lib-date">{timeAgo(lastTouched(p))}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </LibraryShell>
  );
}
