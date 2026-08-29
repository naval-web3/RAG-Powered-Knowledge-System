import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ToastProvider } from "../context/ToastContext";
import { resolvedTheme, toggleTheme } from "../theme";
import { initialsOf } from "../utils";
import ConfirmModal from "./ConfirmModal";
import Icon from "./Icon";
import Tooltip from "./Tooltip";

const PAGE_TITLES = {
  "/": "Chat",
  "/documents": "Documents",
  "/dashboard": "Dashboard",
  "/settings": "Settings",
};

/**
 * How recent a date is, in words. Boundaries are calendar ones -- start of day,
 * of the week (Monday), of the month, of the year -- so "this week" means the
 * week we are in rather than the last seven days.
 */
function recencyLabel(dateish) {
  const then = new Date(dateish);
  if (Number.isNaN(then.getTime())) return "Older";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const day = startOfDay(then);
  const daysBack = Math.round((today - day) / 86400000);

  if (daysBack <= 0) return "Today";
  if (daysBack === 1) return "Yesterday";

  const mondayOffset = (today.getDay() + 6) % 7; // getDay(): 0 = Sunday
  const thisWeek = new Date(today);
  thisWeek.setDate(today.getDate() - mondayOffset);
  if (day >= thisWeek) return "This week";

  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(thisWeek.getDate() - 7);
  if (day >= lastWeek) return "Past week";

  if (day >= new Date(now.getFullYear(), now.getMonth(), 1)) return "This month";
  if (day >= new Date(now.getFullYear(), now.getMonth() - 1, 1)) return "Past month";
  if (day >= new Date(now.getFullYear(), 0, 1)) return "This year";
  if (day >= new Date(now.getFullYear() - 1, 0, 1)) return "Past year";
  return "Older";
}

export default function Layout() {
  return (
    <ToastProvider>
      <ChatProvider>
        <Shell />
      </ChatProvider>
    </ToastProvider>
  );
}

const COLLAPSE_KEY = "retrieva-sidebar-collapsed";

/** Which sidebar sections the user has collapsed, remembered per browser. */
function readCollapsed() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
  } catch {
    return {};
  }
}

// How many recent chats the sidebar shows before offering the full list.
const RECENT_CHATS = 15;

function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const chat = useChat();

  const [collapsed, setCollapsed] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const peekingRef = useRef(false);
  useEffect(() => {
    peekingRef.current = peeking;
  }, [peeking]);
  const topbarRef = useRef(null);
  const reopenRef = useRef(null);
  const resultsRef = useRef(null);
  const resultsInnerRef = useRef(null);
  const convScrollRef = useRef(null);
  const [convFade, setConvFade] = useState({ top: false, bot: false });
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  /* The peeking panel is padded down by the bar's height so its content clears
     it. Measured, because padding and the button inside set that height and a
     hardcoded value would drift the moment either changes. */
  useEffect(() => {
    const el = topbarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const publish = () =>
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  /* A short delay on the way out, so crossing the gap between the edge strip
     and the sidebar does not flicker it shut. Opening is immediate. */
  const openPeek = () => setPeeking(true);
  /* No delay: the zone is one continuous range of x, so leaving it is
     unambiguous and there is no gap to wait out. */
  const closePeek = () => setPeeking(false);

  /* Hover is decided from the pointer's position against a fixed zone, not
     from mouseenter/mouseleave on the sidebar. Opening the peek reflows the
     layout, so the element under the cursor changes mid-hover and those events
     fire in spurious pairs -- which made the panel flicker open and shut. A
     coordinate test cannot move under the pointer. */
  useEffect(() => {
    if (!collapsed) return undefined;
    const EDGE = 8;        // strip down the left edge
    const PANEL = 282;     // sidebar width, once it is out
    const onMove = (e) => {
      // The button's own box, with a couple of pixels of slack so a pointer
      // resting on its edge does not sit on the boundary and stutter.
      const r = reopenRef.current?.getBoundingClientRect();
      const onToggle =
        !!r &&
        e.clientX >= r.left - 2 &&
        e.clientX <= r.right + 2 &&
        e.clientY >= r.top - 2 &&
        e.clientY <= r.bottom + 2;
      const inZone = peekingRef.current
        ? e.clientX <= PANEL
        : e.clientX <= EDGE || onToggle;
      if (inZone) openPeek();
      else closePeek();
    };
    // Leaving the window entirely stops pointermove, so close explicitly.
    const onOut = (e) => {
      if (!e.relatedTarget && !e.toElement) closePeek();
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseout", onOut);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onOut);
    };
  }, [collapsed]);
  useEffect(() => {
    if (!collapsed) setPeeking(false); // pinned open: nothing to peek at
  }, [collapsed]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [menuId, setMenuId] = useState(null);
  // The bar's menu has no conversation id of its own to key on.
  const TOPBAR_MENU = "topbar";
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projName, setProjName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsed);
  const [isDark, setIsDark] = useState(resolvedTheme() === "dark");
  const footRef = useRef(null);

  const onChat = location.pathname === "/";
  const privateActive = chat.privateMode && onChat;
  const [pendingDelete, setPendingDelete] = useState(null);


  /* Ctrl+Shift+P toggles private mode from anywhere. Ignored while typing, so
     it cannot fire mid-message. */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== "p") return;
      const el = document.activeElement;
      const typing = el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      if (!onChat) navigate("/");
      chat.togglePrivate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat, onChat, navigate]);
  const title = PAGE_TITLES[location.pathname] || "Retrieva";
  /* Only a saved conversation has a title worth showing; a new chat has none
     until the first exchange names it. */
  const activeConversation = onChat
    ? chat.conversations.find((c) => c.conversation_id === chat.activeId)
    : null;

  /* The list gains and loses its overflow as chats arrive, groups collapse or
     the window resizes -- none of which fire a scroll event. */
  useEffect(() => {
    const el = convScrollRef.current;
    if (!el) return undefined;
    const measure = () => {
      const top = el.scrollTop > 2;
      const bot = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setConvFade((p) => (p.top === top && p.bot === bot ? p : { top, bot }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  });

  function updateConvFade() {
    const el = convScrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bot = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setConvFade((p) => (p.top === top && p.bot === bot ? p : { top, bot }));
  }

  function commitTitle() {
    if (activeConversation) chat.renameConversation(activeConversation.conversation_id, titleDraft);
    setTitleEditing(false);
  }

  // Close popovers on outside click / route change.
  useEffect(() => {
    const close = (e) => {
      if (footRef.current && !footRef.current.contains(e.target)) setUserMenu(false);
      setMenuId(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const [provider, model] = chat.sel.split("|");

  function handleLogout() {
    logout();
    navigate("/welcome");
  }
  function goto(path) {
    navigate(path);
    setMobileOpen(false);
  }
  function toggleGroup(key) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* private mode or a full quota: the section still toggles for now */
      }
      return next;
    });
  }
  function toggleThemeBtn() {
    toggleTheme();
    setIsDark(resolvedTheme() === "dark");
  }
  function openConv(id) {
    chat.openConversation(id);
    if (!onChat) navigate("/");
    setMobileOpen(false);
  }
  function startNewChat() {
    chat.newChat();
    if (!onChat) navigate("/");
    setMobileOpen(false);
  }
  async function submitNewProject() {
    const clean = projName.trim();
    setCreatingProject(false);
    setProjName("");
    if (!clean) return;
    const project = await chat.createProject(clean);
    navigate(`/projects/${project.project_id}`);
    setMobileOpen(false);
  }

  const query = convSearch.trim().toLowerCase();

  /* The sidebar no longer filters -- searching happens in the dialog, so the
     tree stays put while you look something up. */
  const filtered = useMemo(
    () => chat.conversations.filter((c) => !c.project_id),
    [chat.conversations]
  );

  /* The list resizes as a query narrows it. height:auto cannot animate, so the
     natural height is measured and written out; the CSS transition then has two
     numbers to move between. On open it is set without a transition, or the
     dialog would scale in and grow at once. */
  useEffect(() => {
    const el = resultsRef.current;
    const inner = resultsInnerRef.current;
    if (!el || !inner) return;
    const cap = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    // The inner wrapper is content-sized, so this shrinks as well as grows --
    // el.scrollHeight would never report less than el's own height.
    const next = Math.min(inner.offsetHeight, cap);
    if (!el.dataset.sized) {
      el.style.transition = "none";
      el.style.height = `${next}px`;
      void el.offsetHeight; // commit before the transition is restored
      el.style.transition = "";
      el.dataset.sized = "1";
      return;
    }
    el.style.height = `${next}px`;
  });

  /* One flat list; each row says how recent it is rather than sitting under a
     heading, so nothing breaks the run of results. */
  const searchHits = useMemo(() => {
    const hits = query
      ? chat.conversations.filter((c) => c.title.toLowerCase().includes(query))
      : chat.conversations;
    return hits.map((c) => ({
      conv: c,
      when: recencyLabel(c.updated_at || c.created_at),
    }));
  }, [chat.conversations, query]);

  // Chats that belong to a project, keyed by project, newest first. A search
  // narrows these too, otherwise a chat filed under a project could not be
  // found at all.
  const chatsByProject = useMemo(() => {
    const out = {};
    for (const c of chat.conversations) {
      if (!c.project_id) continue;
      (out[c.project_id] = out[c.project_id] || []).push(c);
    }
    return out;
  }, [chat.conversations]);

  const visibleProjects = chat.projects;
  const projectsOpen = !collapsedGroups.projects;
  const chatsOpen = !collapsedGroups.chats;

  // The API already returns conversations newest first, so the most recent ones
  // are simply the head of the list.
  const shownChats = filtered.slice(0, RECENT_CHATS);

  const navItems = [
    { page: "/", icon: "chat", label: "Chat" },
    { page: "/documents", icon: "file", label: "Documents", count: chat.docCount },
    ...(user?.role === "admin" ? [{ page: "/dashboard", icon: "grid", label: "Dashboard" }] : []),
    { page: "/settings", icon: "sliders", label: "Settings" },
  ];

  const appClass = [
    collapsed ? "sb-collapsed" : "",
    collapsed && peeking ? "sb-peek" : "",
    mobileOpen ? "sb-open" : "",
    privateActive ? "private-chat" : "",

    chat.privateLeaving ? "priv-leaving" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id="app" className={appClass}>
      {mobileOpen && <div id="sb-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside id="sidebar">
        <div className="sb-head">
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); startNewChat(); }}>
            <img className="brand-mark" src="/logo.png" alt="" width="32" height="32" />
            <span className="brand-name">Retrieva</span>
          </a>
          <div className="sb-head-actions">
          {/* Peeking, this pins the sidebar open; pinned, it collapses it. The
              topbar's reopen button sits underneath the peek and cannot be
              clicked, so this is the only control that can pin. */}
          <button className="btn-icon sb-search-btn" title="Search chats" aria-label="Search chats"
            onClick={() => { setConvSearch(""); setSearchOpen(true); }}>
            <Icon name="search" className="icon-sm" />
          </button>
          <button
            className="btn-icon"
            title={collapsed ? "Keep sidebar open" : "Collapse sidebar"}
            aria-label={collapsed ? "Keep sidebar open" : "Collapse sidebar"}
            onClick={() => {
              if (collapsed) {
                setPeeking(false);
                setCollapsed(false);
              } else {
                setCollapsed(true);
              }
            }}>
            <Icon name="panel" className="icon-sm" />
          </button>
          </div>
        </div>

        <div className="sb-section">
          <button className="btn sb-new" onClick={startNewChat}>
            <Icon name="plus" className="icon-sm" /> New chat
          </button>
          <nav className="sb-nav">
            {navItems.map((it) => (
              <button key={it.page}
                className={`sb-item ${location.pathname === it.page ? "active" : ""}`}
                onClick={() => goto(it.page)}>
                <Icon name={it.icon} className="icon-sm" /> {it.label}
                {it.count != null && <span className="count">{it.count}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="sb-projects">
          <div className="sb-group-row">
            <button className="sb-group-toggle" aria-expanded={!collapsedGroups.projects}
              onClick={() => toggleGroup("projects")}>
              <Icon name={projectsOpen ? "chev-d" : "chev-r"} className="chev" />
              <span>Projects</span>
              {!projectsOpen && chat.projects.length > 0 && (
                <span className="sb-group-count">{chat.projects.length}</span>
              )}
            </button>
            <button className="btn-icon" title="New project"
              onClick={() => {
                // Creating one while the section is shut would hide the input.
                setCollapsedGroups((p) => ({ ...p, projects: false }));
                setCreatingProject(true);
                setProjName("");
              }}>
              <Icon name="plus" className="icon-sm" />
            </button>
          </div>
          {projectsOpen && (
          <>
          {creatingProject && (
            <div className="conv-item">
              <input className="rename" autoFocus placeholder="Project name"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewProject();
                  if (e.key === "Escape") { setCreatingProject(false); setProjName(""); }
                }}
                onBlur={submitNewProject} />
            </div>
          )}
          {chat.projects.length === 0 && !creatingProject && (
            <div className="sb-empty sb-empty-sm">
              A project keeps its own documents and instructions, so answers stay on one topic.
            </div>
          )}
          {visibleProjects.map((p) => {
            const open = location.pathname === `/projects/${p.project_id}`;
            const own = chatsByProject[p.project_id] || [];
            return (
              <div key={p.project_id}>
                <div className={`conv-item ${open ? "active" : ""}`}
                  onClick={() => goto(`/projects/${p.project_id}`)}>
                  <Icon name="book" className="icon-sm" />
                  <span className="conv-title">{p.name}</span>
                </div>
                {own.slice(0, 8).map((c) => (
                  <div key={c.conversation_id}
                    className={`conv-item conv-sub ${c.conversation_id === chat.activeId ? "active" : ""}`}
                    onClick={() => openConv(c.conversation_id)}>
                    <span className="conv-title">{c.title}</span>
                  </div>
                ))}
              </div>
            );
          })}

          </>
          )}
        </div>

        {/* Outside the scroller entirely, so it holds its place rather than
            riding to the top and sticking there. Only the chats move. */}
        <div className="sb-group-row sb-chats-head">
          <button className="sb-group-toggle" aria-expanded={!collapsedGroups.chats}
            onClick={() => toggleGroup("chats")}>
            <Icon name={chatsOpen ? "chev-d" : "chev-r"} className="chev" />
            <span>Chats</span>
            {!chatsOpen && filtered.length > 0 && (
              <span className="sb-group-count">{filtered.length}</span>
            )}
          </button>
        </div>

        <div
          className={`sb-scroll ${convFade.top ? "fade-top" : ""} ${convFade.bot ? "fade-bot" : ""}`}
          id="conv-list" ref={convScrollRef} onScroll={updateConvFade}>
          {chatsOpen && (
          <>
          {chat.conversations.length === 0 && (
            <div className="sb-empty">No conversations yet.<br />Start a new chat.</div>
          )}
          {chat.conversations.length > 0 && filtered.length === 0 && (
            <div className="sb-empty">No conversations match “{convSearch}”.</div>
          )}
          <div className="sb-chat-list">
            {shownChats.map((c) => {
                const active = c.conversation_id === chat.activeId;
                if (editingId === c.conversation_id) {
                  return (
                    <div key={c.conversation_id} className="conv-item">
                      <input className="rename" autoFocus value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { chat.renameConversation(c.conversation_id, editTitle); setEditingId(null); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => { chat.renameConversation(c.conversation_id, editTitle); setEditingId(null); }} />
                    </div>
                  );
                }
                return (
                  <div key={c.conversation_id}
                    className={`conv-item ${active ? "active" : ""} ${c.unread ? "is-unread" : ""}`}
                    onClick={() => openConv(c.conversation_id)}>
                    <span className="conv-mark">
                      {/* A pinned row swaps its icon rather than gaining a second
                          one: the pin says as much as the chat glyph did. */}
                      <Icon name={c.pinned ? "pin" : "chat"}
                        className={`icon-sm ${c.pinned ? "conv-pin" : ""}`} />
                      {c.unread && <span className="conv-unread" aria-label="Unread" />}
                    </span>
                    <span className="conv-title">{c.title}</span>
                    <div className="conv-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon" aria-label="Chat options"
                        onClick={() => setMenuId(menuId === c.conversation_id ? null : c.conversation_id)}>
                        <Icon name="more-v" className="icon-sm" />
                      </button>
                      {menuId === c.conversation_id && (
                        <div className="pop-menu conv-menu">
                          <button className="pm-item"
                            onClick={() => { chat.setConversationFlags(c.conversation_id, { pinned: !c.pinned }); setMenuId(null); }}>
                            <Icon name={c.pinned ? "pin-off" : "pin"} className="icon-sm" /> {c.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button className="pm-item"
                            onClick={() => { chat.setConversationFlags(c.conversation_id, { unread: !c.unread }); setMenuId(null); }}>
                            <Icon name={c.unread ? "eye" : "eye-off"} className="icon-sm" /> {c.unread ? "Mark as read" : "Mark as unread"}
                          </button>
                          <button className="pm-item"
                            onClick={() => { setEditingId(c.conversation_id); setEditTitle(c.title); setMenuId(null); }}>
                            <Icon name="pencil" className="icon-sm" /> Rename
                          </button>
                          <div className="pm-sep" />
                          <button className="pm-item danger"
                            onClick={() => { setPendingDelete(c); setMenuId(null); }}>
                            <Icon name="trash" className="icon-sm" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
            })}
          </div>
          {filtered.length > RECENT_CHATS && (
            /* Opens the search dialog rather than growing the list in place:
               it already lists everything, with dates and a filter. */
            <button className="sb-view-all"
              onClick={() => { setConvSearch(""); setSearchOpen(true); }}>
              View all conversations
            </button>
          )}
          </>
          )}
        </div>

        <div className="sb-foot" ref={footRef}>
          {userMenu && (
            <div className="pop-menu">
              <button className="pm-item" onClick={() => { toggleThemeBtn(); }}>
                <Icon name={isDark ? "sun" : "moon"} className="icon-sm" />
                <span>{isDark ? "Light mode" : "Dark mode"}</span>
              </button>
              <button className="pm-item" onClick={() => { setUserMenu(false); goto("/settings"); }}>
                <Icon name="sliders" className="icon-sm" /> Settings
              </button>
              <div className="pm-sep" />
              <button className="pm-item danger" onClick={handleLogout}>
                <Icon name="logout" className="icon-sm" /> Sign out
              </button>
            </div>
          )}
          <button className="user-chip" aria-haspopup="true"
            onClick={(e) => { e.stopPropagation(); setUserMenu((v) => !v); }}>
            <span className="avatar">{initialsOf(user?.username)}</span>
            <span className="u-meta">
              <span className="u-name">{user?.username}</span>
              <span className="u-mail">{user?.email}</span>
            </span>
            <Icon name="more" className="icon-sm" style={{ color: "var(--text-3)" }} />
          </button>
        </div>
      </aside>

      <div id="main">
        <header className="topbar" ref={topbarRef}>
          {privateActive ? (
            /* Nothing but what the mode is, and the way out. */
            <>
              <span className="private-bar-label">
                <Icon name="ghost" className="icon-sm" /> Private chat
              </span>
              <button className="private-bar-x" title="Leave private chat"
                aria-label="Leave private chat" onClick={() => chat.togglePrivate()}>
                <Icon name="x" className="icon-sm" />
              </button>
            </>
          ) : (
            <>
            <button className="btn-icon" id="btn-mobile-menu" aria-label="Open menu"
              onClick={() => setMobileOpen(true)}>
              <Icon name="menu" />
            </button>
            {collapsed && (
              <button ref={reopenRef} className="btn-icon sb-reopen" title="Open sidebar"
                aria-label="Open sidebar"
                onClick={() => { setPeeking(false); setCollapsed(false); }}>
                <Icon name="panel" className="icon-sm" />
                <span className="sb-dot" aria-hidden="true" />
              </button>
            )}
            {/* The chat page needs no label -- a conversation on screen says what
                it is -- but a saved one shows its own name, editable in place. */}
            {!onChat && <h1>{title}</h1>}
            {activeConversation &&
              (titleEditing ? (
                <input
                  className="conv-title-edit"
                  autoFocus
                  // Fallback sizing for browsers without CSS field-sizing.
                  size={Math.max(8, titleDraft.length + 1)}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") setTitleEditing(false);
                  }}
                  onBlur={commitTitle}
                />
              ) : (
                /* The window-level handler closes every popover, so the clicks
                   that open this one must not reach it. */
                <div className="conv-title-wrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="conv-title-btn"
                    title="Rename this chat"
                    onClick={() => { setTitleDraft(activeConversation.title); setTitleEditing(true); }}
                  >
                    {activeConversation.title}
                  </button>
                  <button className="btn-icon conv-title-caret" aria-label="Chat options"
                    aria-expanded={menuId === TOPBAR_MENU}
                    onClick={() => setMenuId(menuId === TOPBAR_MENU ? null : TOPBAR_MENU)}>
                    <Icon name="chev-d" className="icon-sm" />
                  </button>
                  {menuId === TOPBAR_MENU && (
                    <div className="pop-menu conv-menu title-menu">
                      <button className="pm-item"
                        onClick={() => { chat.setConversationFlags(activeConversation.conversation_id, { pinned: !activeConversation.pinned }); setMenuId(null); }}>
                        <Icon name={activeConversation.pinned ? "pin-off" : "pin"} className="icon-sm" />
                        {activeConversation.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button className="pm-item"
                        onClick={() => { chat.setConversationFlags(activeConversation.conversation_id, { unread: !activeConversation.unread }); setMenuId(null); }}>
                        <Icon name={activeConversation.unread ? "eye" : "eye-off"} className="icon-sm" />
                        {activeConversation.unread ? "Mark as read" : "Mark as unread"}
                      </button>
                      <button className="pm-item"
                        onClick={() => { setTitleDraft(activeConversation.title); setTitleEditing(true); setMenuId(null); }}>
                        <Icon name="pencil" className="icon-sm" /> Rename
                      </button>
                      <div className="pm-sep" />
                      <button className="pm-item danger"
                        onClick={() => { setPendingDelete(activeConversation); setMenuId(null); }}>
                        <Icon name="trash" className="icon-sm" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            <div className="grow" />
            <span className="provider-pill" title="Active LLM provider">
              <span className="dot" />
              <span>{provider} · {model}</span>
            </span>
            <button className="btn-icon" title="Toggle theme" aria-label="Toggle theme"
              onClick={toggleThemeBtn}>
              <Icon name={isDark ? "sun" : "moon"} className="icon-sm" />
            </button>
            {/* Last, so it sits in the same corner the cross occupies in
                private mode: one place to switch the mode either way. */}
            <Tooltip label="Private chat" keys="Ctrl+Shift+P">
              <button
                className={`private-toggle ${chat.privateMode ? "on" : ""}`}
                aria-label="Toggle private chat" aria-pressed={chat.privateMode}
                onClick={() => { if (!onChat) navigate("/"); chat.togglePrivate(); }}>
                <Icon name="ghost" className="ghost-icon" />
              </button>
            </Tooltip>
            </>
          )}
        </header>

        <Outlet />
      </div>

      {searchOpen && (
        <div className="modal-overlay search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="modal search-modal" role="dialog" aria-modal="true"
            onClick={(e) => e.stopPropagation()}>
            <div className="search-field">
              <Icon name="search" className="icon-sm" />
              <input
                autoFocus
                type="text"
                placeholder="Search chats and projects"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
              />
              <button className="btn-icon" aria-label="Close search"
                onClick={() => setSearchOpen(false)}>
                <Icon name="x" className="icon-sm" />
              </button>
            </div>
            <div className="search-results" ref={resultsRef}>
              <div className="search-results-inner" ref={resultsInnerRef}>
                {searchHits.length === 0 && (
                  <p className="search-empty">Nothing matches “{convSearch}”.</p>
                )}
                {searchHits.map(({ conv, when }) => (
                  <button key={conv.conversation_id} className="search-hit"
                    onClick={() => { setSearchOpen(false); openConv(conv.conversation_id); }}>
                    <Icon name="chat" className="icon-sm" />
                    <span className="search-hit-title">{conv.title}</span>
                    <span className="search-hit-when">{when}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete chat?"
          text="Are you sure you want to delete this chat?"
          okLabel="Delete"
          onConfirm={() => {
            chat.deleteConversation(pendingDelete.conversation_id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
