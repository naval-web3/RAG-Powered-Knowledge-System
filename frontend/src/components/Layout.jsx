import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ToastProvider } from "../context/ToastContext";
import { resolvedTheme, toggleTheme } from "../theme";
import { initialsOf } from "../utils";
import Icon from "./Icon";

const PAGE_TITLES = {
  "/": "Chat",
  "/documents": "Documents",
  "/dashboard": "Dashboard",
  "/settings": "Settings",
};

export default function Layout() {
  return (
    <ToastProvider>
      <ChatProvider>
        <Shell />
      </ChatProvider>
    </ToastProvider>
  );
}

/** Bucket conversations by recency for the sidebar sections. */
function groupConversations(list) {
  const now = Date.now();
  const day = 86400000;
  const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const c of list) {
    const age = now - new Date(c.updated_at).getTime();
    if (age < day) groups["Today"].push(c);
    else if (age < 2 * day) groups["Yesterday"].push(c);
    else if (age < 7 * day) groups["Previous 7 days"].push(c);
    else groups["Older"].push(c);
  }
  return Object.entries(groups).filter(([, arr]) => arr.length > 0);
}

function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const chat = useChat();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projName, setProjName] = useState("");
  const [isDark, setIsDark] = useState(resolvedTheme() === "dark");
  const footRef = useRef(null);

  const onChat = location.pathname === "/";
  const privateActive = chat.privateMode && onChat;
  const title = PAGE_TITLES[location.pathname] || "Retrieva";

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

  const filtered = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    const loose = chat.conversations.filter((c) => !c.project_id);
    if (!q) return loose;
    return loose.filter((c) => c.title.toLowerCase().includes(q));
  }, [chat.conversations, convSearch]);

  // Chats that belong to a project, keyed by project, newest first.
  const chatsByProject = useMemo(() => {
    const out = {};
    for (const c of chat.conversations) {
      if (!c.project_id) continue;
      (out[c.project_id] = out[c.project_id] || []).push(c);
    }
    return out;
  }, [chat.conversations]);

  const groups = groupConversations(filtered);

  const navItems = [
    { page: "/", icon: "chat", label: "Chat" },
    { page: "/documents", icon: "file", label: "Documents", count: chat.docCount },
    ...(user?.role === "admin" ? [{ page: "/dashboard", icon: "grid", label: "Dashboard" }] : []),
    { page: "/settings", icon: "sliders", label: "Settings" },
  ];

  const appClass = [
    collapsed ? "sb-collapsed" : "",
    mobileOpen ? "sb-open" : "",
    privateActive ? "private-chat" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id="app" className={appClass}>
      {mobileOpen && <div id="sb-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside id="sidebar">
        <div className="sb-head">
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); startNewChat(); }}>
            <span className="brand-mark"><Icon name="spark" /></span>
            <span className="brand-name">Retrieva</span>
          </a>
          <button className="btn-icon" title="Collapse sidebar" aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}>
            <Icon name="panel" className="icon-sm" />
          </button>
        </div>

        <div className="sb-section">
          <button className="btn sb-new" onClick={startNewChat}>
            <Icon name="plus" className="icon-sm" /> New chat
          </button>
          <div className="sb-search">
            <Icon name="search" className="icon-sm" />
            <input type="text" placeholder="Search conversations…" autoComplete="off"
              value={convSearch} onChange={(e) => setConvSearch(e.target.value)} />
          </div>
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

        <div className="sb-scroll" id="conv-list">
          <div className="sb-group-label sb-group-row">
            <span>Projects</span>
            <button className="btn-icon" title="New project"
              onClick={() => { setCreatingProject(true); setProjName(""); }}>
              <Icon name="plus" className="icon-sm" />
            </button>
          </div>
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
              Group documents and instructions into a project to keep answers to one topic.
            </div>
          )}
          {chat.projects.map((p) => {
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

          <div className="sb-group-label" style={{ marginTop: 14 }}>Chats</div>
          {chat.conversations.length === 0 && (
            <div className="sb-empty">No conversations yet.<br />Start a new chat to begin.</div>
          )}
          {chat.conversations.length > 0 && groups.length === 0 && (
            <div className="sb-empty">No conversations match “{convSearch}”.</div>
          )}
          {groups.map(([label, items]) => (
            <div key={label}>
              <div className="sb-group-label">{label}</div>
              {items.map((c) => {
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
                    className={`conv-item ${active ? "active" : ""}`}
                    onClick={() => openConv(c.conversation_id)}>
                    <Icon name="chat" className="icon-sm" />
                    <span className="conv-title">{c.title}</span>
                    <div className="conv-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon" title="Rename"
                        onClick={() => { setEditingId(c.conversation_id); setEditTitle(c.title); setMenuId(null); }}>
                        <Icon name="pencil" className="icon-sm" />
                      </button>
                      <button className="btn-icon" title="Delete"
                        onClick={() => chat.deleteConversation(c.conversation_id)}>
                        <Icon name="trash" className="icon-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
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
              <span className="u-role">{user?.role === "admin" ? "Administrator" : "User"}</span>
            </span>
            <Icon name="more" className="icon-sm" style={{ color: "var(--text-3)" }} />
          </button>
        </div>
      </aside>

      <div id="main">
        <header className="topbar">
          <button className="btn-icon" id="btn-mobile-menu" aria-label="Open menu"
            onClick={() => setMobileOpen(true)}>
            <Icon name="menu" />
          </button>
          {collapsed && (
            <button className="btn-icon" title="Open sidebar" aria-label="Open sidebar"
              onClick={() => setCollapsed(false)}>
              <Icon name="panel" className="icon-sm" />
            </button>
          )}
          <h1>{title}</h1>
          {privateActive && (
            <span className="private-badge"><Icon name="ghost" className="icon-sm" /> Private</span>
          )}
          <div className="grow" />
          <button
            className={`btn-icon private-toggle ${chat.privateMode ? "on" : ""}`}
            title="Start a private chat that is never saved"
            aria-label="Toggle private chat" aria-pressed={chat.privateMode}
            onClick={() => { if (!onChat) navigate("/"); chat.togglePrivate(); }}>
            <Icon name="ghost" className="icon-sm" />
          </button>
          <span className="provider-pill" title="Active LLM provider">
            <span className="dot" />
            <span>{provider} · {model}</span>
          </span>
          <button className="btn-icon" title="Toggle theme" aria-label="Toggle theme"
            onClick={toggleThemeBtn}>
            <Icon name={isDark ? "sun" : "moon"} className="icon-sm" />
          </button>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
