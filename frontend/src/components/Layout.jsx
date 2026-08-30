import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ToastProvider } from "../context/ToastContext";
import { useLocale, useT } from "../i18n";
import useEdgeFade from "../useEdgeFade";
import { languageOf } from "../i18n/languages";
import { getThemePref, setTheme } from "../theme";
import { initialsOf } from "../utils";
import ConfirmModal from "./ConfirmModal";
import DocumentDialog from "./DocumentDialog";
import Icon from "./Icon";
import Keys from "./Keys";
import LanguageDialog from "./LanguageDialog";
import SettingsDialog from "./SettingsDialog";
import Tooltip from "./Tooltip";

const PAGE_TITLES = {
  "/": "Chat",
  "/documents": "Documents",
  "/dashboard": "Dashboard",
};

/**
 * How recent a date is, as a string KEY rather than words: the caller
 * translates it. Boundaries are calendar ones -- start of day, of the week
 * (Monday), of the month, of the year -- so "this week" means the week we are
 * in rather than the last seven days.
 */
function recencyKey(dateish) {
  const then = new Date(dateish);
  if (Number.isNaN(then.getTime())) return "recency.older";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const day = startOfDay(then);
  const daysBack = Math.round((today - day) / 86400000);

  if (daysBack <= 0) return "recency.today";
  if (daysBack === 1) return "recency.yesterday";

  const mondayOffset = (today.getDay() + 6) % 7; // getDay(): 0 = Sunday
  const thisWeek = new Date(today);
  thisWeek.setDate(today.getDate() - mondayOffset);
  if (day >= thisWeek) return "recency.thisWeek";

  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(thisWeek.getDate() - 7);
  if (day >= lastWeek) return "recency.pastWeek";

  if (day >= new Date(now.getFullYear(), now.getMonth(), 1)) return "recency.thisMonth";
  if (day >= new Date(now.getFullYear(), now.getMonth() - 1, 1)) return "recency.pastMonth";
  if (day >= new Date(now.getFullYear(), 0, 1)) return "recency.thisYear";
  if (day >= new Date(now.getFullYear() - 1, 0, 1)) return "recency.pastYear";
  return "recency.older";
}

/**
 * A popover rendered into <body> and positioned from its anchor's box.
 *
 * The row menu used to live inside .sb-scroll, which clips what overflows it
 * and fades its own last 22px -- so a menu opened on one of the bottom rows
 * came out cut in half and greyed. Out here nothing crops it, at the cost of
 * having to place it by hand.
 */
function PortalMenu({ anchorRef, align = "right", className = "", children }) {
  const boxRef = useRef(null);
  const [pos, setPos] = useState(null);

  /* No dependency array on purpose: children change identity on every render
     of the owner, and the anchor moves whenever anything scrolls or resizes.
     Re-measuring each time is cheap; what matters is that identical numbers
     do not schedule another render, or this would never settle. */
  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const box = boxRef.current;
      if (!anchor || !box) return;
      const r = anchor.getBoundingClientRect();
      const h = box.offsetHeight;
      const below = window.innerHeight - r.bottom;
      // Flip up only when there is genuinely more room up there, so a menu
      // near the bottom does not jump above a button with space to spare.
      const up = below < h + 12 && r.top > below;
      const next = {
        top: up ? Math.max(8, r.top - h - 4) : r.bottom + 4,
        left: align === "left" ? Math.max(8, r.left) : null,
        right: align === "left" ? null : Math.max(8, window.innerWidth - r.right),
      };
      setPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.right === next.right
          ? prev
          : next
      );
    };
    place();
    window.addEventListener("resize", place);
    // Capture phase: a scroll inside the sidebar carries the anchor with it
    // and never reaches window on its own.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  });

  return createPortal(
    <div
      ref={boxRef}
      className={`pop-menu is-portal ${className}`}
      style={{
        top: pos ? pos.top : 0,
        left: pos && pos.left != null ? pos.left : undefined,
        right: pos && pos.right != null ? pos.right : undefined,
        // Hidden for the first pass only: the height has to be measured before
        // it can be decided whether the menu hangs down or up.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * The project picker that flies out of "Add to project".
 *
 * It is a plain absolutely-positioned child of the row rather than a second
 * portal: it sits flush against the row's right edge (left: 100%, no gap), so
 * the pointer crossing into it never leaves the hover area and no timer is
 * needed to keep it open. It flips to the left when there is no room.
 */
function ProjectFlyout({ conv, projects, onMove, onCreate }) {
  const t = useT();
  const [listRef, listFade] = useEdgeFade();
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const [place, setPlace] = useState({ flip: false, lift: 0 });

  /* Placed once, from the box's UNADJUSTED rect. Both corrections are deltas,
     so measuring again after one had been applied would just chase itself. */
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const flip = r.right > window.innerWidth - 8;
    // Lift by however much hangs below the fold, but never past the top edge.
    let lift = Math.max(0, r.bottom - (window.innerHeight - 8));
    lift = Math.min(lift, Math.max(0, r.top - 8));
    setPlace({ flip, lift });
  }, []);

  const query = q.trim().toLowerCase();
  const hits = query ? projects.filter((p) => p.name.toLowerCase().includes(query)) : projects;
  const exact = projects.some((p) => p.name.toLowerCase() === query);

  return (
    <div ref={boxRef} className={`pop-menu pm-flyout ${place.flip ? "flip" : ""}`}
      style={place.lift ? { top: -7 - place.lift } : undefined}>
      <div className="pm-search">
        <Icon name="search" className="icon-sm" />
        <input
          autoFocus
          value={q}
          placeholder={t("menu.searchOrCreate")}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (hits.length === 1) onMove(conv, hits[0].project_id);
            else if (query && !exact) onCreate(conv, q.trim());
          }}
        />
      </div>
      <div className={`pm-flyout-list ${listFade}`} ref={listRef}>
        {hits.map((p) => (
          <button key={p.project_id} className="pm-item" onClick={() => onMove(conv, p.project_id)}>
            <span className="pm-label">{p.name}</span>
            {conv.project_id === p.project_id && <Icon name="check" className="icon-sm pm-check" />}
          </button>
        ))}
        {hits.length === 0 && (
          <p className="pm-empty">
            {projects.length === 0
              ? t("menu.noProjects")
              : t("sidebar.nothingMatches", { q: q.trim() })}
          </p>
        )}
      </div>
      {conv.project_id && (
        <>
          <div className="pm-sep" />
          <button className="pm-item" onClick={() => onMove(conv, null)}>
            <Icon name="x" className="icon-sm" /> {t("menu.removeFromProject")}
          </button>
        </>
      )}
      <div className="pm-sep" />
      {/* Named by whatever is in the field. Empty, it points back at the field
          rather than inventing a name. */}
      <button
        className="pm-item"
        onClick={() => {
          const name = q.trim();
          if (name && !exact) onCreate(conv, name);
          else boxRef.current?.querySelector("input")?.focus();
        }}
      >
        <Icon name="plus" className="icon-sm" />
        <span className="pm-label">
          {q.trim() && !exact
            ? t("menu.startNamed", { name: q.trim() })
            : t("menu.startNewProject")}
        </span>
      </button>
    </div>
  );
}

/**
 * What is inside a chat menu. One component for the row menu and the one under
 * the conversation title, so their wording cannot drift apart.
 */
function ChatMenuItems({ conv, projects, onAction, onMove, onCreate }) {
  const t = useT();
  const [subOpen, setSubOpen] = useState(false);
  const closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // A short grace period covers a diagonal move across the row's corner; the
  // flyout itself is inside this element, so a straight move never triggers it.
  const hold = () => { clearTimeout(closeTimer.current); setSubOpen(true); };
  const release = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSubOpen(false), 150);
  };

  return (
    <>
      <button className="pm-item" onClick={() => onAction(conv, "p")} onMouseEnter={release}>
        <Icon name={conv.pinned ? "pin-off" : "pin"} className="icon-sm" />
        {conv.pinned ? t("menu.unpin") : t("menu.pin")}
      </button>
      <button className="pm-item" onClick={() => onAction(conv, "u")} onMouseEnter={release}>
        <Icon name={conv.unread ? "eye" : "eye-off"} className="icon-sm" />
        {conv.unread ? t("menu.markRead") : t("menu.markUnread")}
      </button>
      <button className="pm-item" onClick={() => onAction(conv, "r")} onMouseEnter={release}>
        <Icon name="pencil" className="icon-sm" /> {t("common.rename")}
      </button>

      <div className="pm-sub-anchor" onMouseEnter={hold} onMouseLeave={release}>
        <button className="pm-item" aria-haspopup="true" aria-expanded={subOpen}
          onClick={() => setSubOpen((o) => !o)}>
          <Icon name="book" className="icon-sm" />
          <span className="pm-label">
            {conv.project_id ? t("menu.moveToProject") : t("menu.addToProject")}
          </span>
          <Icon name="chev-r" className="icon-sm pm-arrow" />
        </button>
        {subOpen && (
          <ProjectFlyout conv={conv} projects={projects} onMove={onMove} onCreate={onCreate} />
        )}
      </div>

      <div className="pm-sep" />
      <button className="pm-item danger" onClick={() => onAction(conv, "d")} onMouseEnter={release}>
        <Icon name="trash" className="icon-sm" /> {t("common.delete")}
      </button>
    </>
  );
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
  const { locale, t } = useLocale();

  /* Declared here rather than beside the rest of the derived values: the peek
     effects below read privateActive, and a const declared under them is in its
     temporal dead zone when their dependency arrays are evaluated. */
  const onChat = location.pathname === "/";
  const onNewChat = onChat && !chat.activeId;
  const privateActive = chat.privateMode && onChat;

  const [collapsed, setCollapsed] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const peekingRef = useRef(false);
  useEffect(() => {
    peekingRef.current = peeking;
  }, [peeking]);
  const topbarRef = useRef(null);
  const reopenRef = useRef(null);
  const resultsRef = useRef(null);
  const [hitsRef, hitsFade] = useEdgeFade();
  const resultsInnerRef = useRef(null);
  const [convScrollRef, convFade] = useEdgeFade();
  const [projScrollRef, projFade] = useEdgeFade();
  // Only one menu is open at a time, so one anchor ref each is enough.
  const rowMenuBtnRef = useRef(null);
  const titleMenuBtnRef = useRef(null);
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
    // Not while private: the sidebar is gone from this screen, so there is
    // nothing at the left edge to peek at.
    if (!collapsed || privateActive) return undefined;
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
    // Pinned open, or private: either way there is nothing to peek at.
    if (!collapsed || privateActive) setPeeking(false);
  }, [collapsed, privateActive]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // The document being read, or null. Rows open it; the dialog owns the rest.
  const [openDoc, setOpenDoc] = useState(null);
  const uploadRef = useRef(null);
  const [userMenu, setUserMenu] = useState(false);
  const [menuId, setMenuId] = useState(null);
  // The bar's menu has no conversation id of its own to key on.
  const TOPBAR_MENU = "topbar";
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projName, setProjName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsed);
  const [themePref, setThemePref] = useState(getThemePref);
  const footRef = useRef(null);

  const [pendingDelete, setPendingDelete] = useState(null);


  /* The three window shortcuts, in one place.
       Ctrl+Shift+O  new chat
       Ctrl+Shift+S  settings
       Ctrl+Shift+P  private mode

     O and S work while you are typing: reaching for a new chat in the middle of
     a draft is exactly when you want one, and neither touches what you wrote.
     P keeps its guard, because it changes the mode of the chat you are typing
     into, and doing that by accident mid-message would be its own small
     disaster.

     No dependency array: these read state that changes on nearly every render,
     and a stale closure would act on the wrong chat. */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        startNewChat();
      } else if (key === "s") {
        e.preventDefault();
        openSettings();
      } else if (key === "p") {
        const el = document.activeElement;
        const typing =
          el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        if (!onChat) navigate("/");
        chat.togglePrivate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const title = PAGE_TITLES[location.pathname] || "Retrieva";
  /* Only a saved conversation has a title worth showing; a new chat has none
     until the first exchange names it. */
  const activeConversation = onChat
    ? chat.conversations.find((c) => c.conversation_id === chat.activeId)
    : null;


  function menuAction(conv, key) {
    if (!conv) return;
    if (key === "p") chat.setConversationFlags(conv.conversation_id, { pinned: !conv.pinned });
    else if (key === "u") chat.setConversationFlags(conv.conversation_id, { unread: !conv.unread });
    else if (key === "r") {
      if (menuId === TOPBAR_MENU) { setTitleDraft(conv.title); setTitleEditing(true); }
      else { setEditingId(conv.conversation_id); setEditTitle(conv.title); }
    } else if (key === "d") setPendingDelete(conv);
    else return;
    setMenuId(null);
  }

  function moveConv(conv, projectId) {
    setMenuId(null);
    chat.moveConversation(conv.conversation_id, projectId);
  }

  /* Create the project and file the chat into it in one go: the flyout is
     reached from a chat, so a new project made there is always meant to hold
     the chat that opened it. */
  async function createAndMove(conv, name) {
    setMenuId(null);
    const project = await chat.createProject(name);
    if (project) chat.moveConversation(conv.conversation_id, project.project_id);
  }

  // Escape closes an open menu. The P/U/R/D letters were removed: they were
  // undiscoverable and fired on chats the pointer had already left.
  useEffect(() => {
    if (menuId === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuId]);

  // Close popovers on outside click / route change.
  useEffect(() => {
    const close = (e) => {
      if (footRef.current && !footRef.current.contains(e.target)) setUserMenu(false);
      /* A chat menu now renders into <body>, so its clicks no longer pass
         through the row's stopPropagation on their way here. Anything inside
         an open menu is that menu's own business: its items close it
         themselves, and "Add to project" deliberately does not. */
      if (e.target instanceof Element && e.target.closest(".pop-menu")) return;
      setMenuId(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
  function changeTheme(pref) {
    setThemePref(pref);
    setTheme(pref);
  }
  function openConv(id) {
    chat.openConversation(id);
    if (!onChat) navigate("/");
    setMobileOpen(false);
  }
  function openSettings() {
    setSettingsOpen(true);
    setMobileOpen(false);
    setUserMenu(false);
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
      when: t(recencyKey(c.updated_at || c.created_at)),
    }));
  }, [chat.conversations, query, t]);

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
  const docsOpen = !collapsedGroups.docs;
  const chatsOpen = !collapsedGroups.chats;

  // The API already returns conversations newest first, so the most recent ones
  // are simply the head of the list.
  const shownChats = filtered.slice(0, RECENT_CHATS);

  // Documents have their own section below, so the nav is the dashboard alone.
  const navItems = user?.role === "admin"
    ? [{ page: "/dashboard", icon: "grid", label: t("sidebar.dashboard") }]
    : [];

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
          <Tooltip label={t("sidebar.searchChats")}>
            <button className="btn-icon sb-search-btn" aria-label={t("sidebar.searchChats")}
              onClick={() => { setConvSearch(""); setSearchOpen(true); }}>
              <Icon name="search" className="icon-sm" />
            </button>
          </Tooltip>
          {/* Against the panel's right edge, but the main column is beside it,
              so there is room below. */}
          <Tooltip label={collapsed ? t("sidebar.keepOpen") : t("sidebar.collapse")}>
            <button
              className="btn-icon"
              aria-label={collapsed ? t("sidebar.keepOpen") : t("sidebar.collapse")}
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
          </Tooltip>
          </div>
        </div>

        <div className="sb-section">
          <button className={`btn sb-new ${onNewChat ? "active" : ""}`} onClick={startNewChat}>
            <Icon name="plus" className="icon-sm" /> {t("sidebar.newChat")}
            <Keys combo="ctrl+shift+o" className="row-hint" />
          </button>
          {navItems.length > 0 && (
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
          )}
        </div>

        <div
          className={`sb-projects ${projFade}`} ref={projScrollRef}>

          <div className="sb-group-row">
            <button className="sb-group-toggle" aria-expanded={!collapsedGroups.docs}
              onClick={() => toggleGroup("docs")}>
              <span>{t("docs.section")}</span>
              <Icon name={docsOpen ? "chev-d" : "chev-r"} className="chev" />
            </button>
            <Tooltip label={t("docs.upload")}>
              <button className="btn-icon" aria-label={t("docs.upload")}
                disabled={chat.uploading}
                onClick={() => {
                  setCollapsedGroups((p) => ({ ...p, docs: false }));
                  uploadRef.current?.click();
                }}>
                <Icon name={chat.uploading ? "refresh" : "plus"} className="icon-sm" />
              </button>
            </Tooltip>
          </div>
          {docsOpen && (
            <>
              {chat.docs.length === 0 && (
                <div className="sb-empty sb-empty-sm">{t("docs.empty")}</div>
              )}
              {chat.docs.map((d) => {
                const busy = d.processing_status !== "done" && d.processing_status !== "failed";
                return (
                  <div key={d.document_id} className="conv-item doc-item"
                    onClick={() => setOpenDoc(d)}>
                    <Icon name="file" className="icon-sm" />
                    <span className="conv-title">{d.title}</span>
                    {d.processing_status === "failed" && (
                      <Tooltip label={t("docs.failed")}>
                        <span className="doc-failed" />
                      </Tooltip>
                    )}
                    {/* A bar only while there is something to watch: nearly every
                        document is finished, and a full bar on all of them would
                        be noise. */}
                    {busy && (
                      <span className="doc-progress">
                        <span style={{ width: `${Math.max(4, d.progress || 0)}%` }} />
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div className="sb-group-row sb-projects-head">
            <button className="sb-group-toggle" aria-expanded={!collapsedGroups.projects}
              onClick={() => toggleGroup("projects")}>
              <span>{t("sidebar.projects")}</span>
              <Icon name={projectsOpen ? "chev-d" : "chev-r"} className="chev" />
            </button>
            <Tooltip label={t("sidebar.newProject")}>
              <button className="btn-icon" aria-label={t("sidebar.newProject")}
                onClick={() => {
                  // Creating one while the section is shut would hide the input.
                  setCollapsedGroups((p) => ({ ...p, projects: false }));
                  setCreatingProject(true);
                  setProjName("");
                }}>
                <Icon name="plus" className="icon-sm" />
              </button>
            </Tooltip>
          </div>
          {projectsOpen && (
          <>
          {creatingProject && (
            <div className="conv-item">
              <Icon name="book" className="icon-sm" />
              <input className="conv-title rename" autoFocus placeholder={t("sidebar.projectName")}
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
              {t("sidebar.projectHint")}
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
            <span>{t("sidebar.chats")}</span>
            <Icon name={chatsOpen ? "chev-d" : "chev-r"} className="chev" />
          </button>
        </div>

        <div
          className={`sb-scroll ${convFade}`} id="conv-list" ref={convScrollRef}>
          {chatsOpen && (
          <>
          {chat.conversations.length === 0 && (
            <div className="sb-empty">
              {t("sidebar.noConversations")}<br />{t("sidebar.startNewChat")}
            </div>
          )}
          {chat.conversations.length > 0 && filtered.length === 0 && (
            <div className="sb-empty">{t("sidebar.noMatchingChats", { q: convSearch })}</div>
          )}
          <div className="sb-chat-list">
            {shownChats.map((c) => {
                const active = c.conversation_id === chat.activeId;
                const open = menuId === c.conversation_id;
                const editing = editingId === c.conversation_id;
                const commit = () => {
                  chat.renameConversation(c.conversation_id, editTitle);
                  setEditingId(null);
                };
                return (
                  <div key={c.conversation_id}
                    className={`conv-item ${active ? "active" : ""} ${c.unread ? "is-unread" : ""} ${open ? "menu-open" : ""}`}
                    onClick={() => { if (!editing) openConv(c.conversation_id); }}>
                    <span className="conv-mark">
                      {/* A pinned row swaps its icon rather than gaining a second
                          one: the pin says as much as the chat glyph did. */}
                      <Icon name={c.pinned ? "pin" : "chat"}
                        className={`icon-sm ${c.pinned ? "conv-pin" : ""}`} />
                      {c.unread && <span className="conv-unread" aria-label="Unread" />}
                    </span>
                    {/* The same box in the same place, carrying the same class:
                        the row does not reflow, it just becomes typeable. */}
                    {editing ? (
                      <input className="conv-title rename" autoFocus value={editTitle}
                        aria-label={t("common.rename")}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={commit} />
                    ) : (
                      <span className="conv-title">{c.title}</span>
                    )}
                    <div className="conv-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon" aria-label={t("menu.chatOptions")}
                        ref={open ? rowMenuBtnRef : null}
                        aria-expanded={open}
                        onClick={() => setMenuId(open ? null : c.conversation_id)}>
                        <Icon name="more-v" className="icon-sm" />
                      </button>
                      {open && (
                        <PortalMenu anchorRef={rowMenuBtnRef} align="right" className="conv-menu">
                          <ChatMenuItems conv={c} projects={chat.projects}
                            onAction={menuAction} onMove={moveConv} onCreate={createAndMove} />
                        </PortalMenu>
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
              {t("sidebar.viewAll")}
            </button>
          )}
          </>
          )}
        </div>

        <div className="sb-foot" ref={footRef}>
          {userMenu && (
            <div className="pop-menu">
              {/* Not a button: it holds three of them. The same segmented
                  control as Settings > General, so the two agree on what the
                  choice looks like and there is no "Dark mode" row that lies
                  about which mode you are in. */}
              <div className="pm-row">
                <span className="pm-label">{t("common.appearance")}</span>
                <div className="set-seg pm-seg">
                  {[["system", "monitor"], ["light", "sun"], ["dark", "moon"]].map(([val, ic]) => (
                    <Tooltip key={val} label={t(`theme.${val}`)} placement="top">
                      <button className={themePref === val ? "active" : ""}
                        aria-label={t(`theme.${val}`)}
                        onClick={() => changeTheme(val)}>
                        <Icon name={ic} className="icon-sm" />
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <button className="pm-item" onClick={() => { setUserMenu(false); setLangOpen(true); }}>
                <Icon name="globe" className="icon-sm" />
                <span className="pm-label">{t("common.language")}</span>
                <span className="pm-trail">{languageOf(locale).short}</span>
              </button>
              <button className="pm-item" onClick={openSettings}>
                <Icon name="settings" className="icon-sm" />
                <span className="pm-label">{t("common.settings")}</span>
                <Keys combo="ctrl+shift+s" className="row-hint" />
              </button>
              <div className="pm-sep" />
              <button className="pm-item danger" onClick={handleLogout}>
                <Icon name="logout" className="icon-sm" /> {t("common.signOut")}
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
                <Icon name="ghost" className="icon-sm" /> {t("topbar.privateChat")}
              </span>
              {/* Same corner as the toggle it replaces, so the same escape. */}
              <Tooltip label={t("topbar.leavePrivate")} placement="left">
                <button className="private-bar-x" aria-label={t("topbar.leavePrivate")}
                  onClick={() => chat.togglePrivate()}>
                  <Icon name="x" className="icon-sm" />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
            <Tooltip label={t("sidebar.openMenu")} className="only-narrow">
              <button className="btn-icon" id="btn-mobile-menu" aria-label={t("sidebar.openMenu")}
                onClick={() => setMobileOpen(true)}>
                <Icon name="menu" />
              </button>
            </Tooltip>
            {collapsed && (
              <Tooltip label={t("sidebar.openSidebar")} className="reopen-wrap">
                <button ref={reopenRef} className="btn-icon sb-reopen"
                  aria-label={t("sidebar.openSidebar")}
                  onClick={() => { setPeeking(false); setCollapsed(false); }}>
                  <Icon name="panel" className="icon-sm" />
                  <span className="sb-dot" aria-hidden="true" />
                </button>
              </Tooltip>
            )}
            {/* The chat page needs no label -- a conversation on screen says what
                it is -- but a saved one shows its own name, editable in place. */}
            {!onChat && <h1>{title}</h1>}
            {activeConversation &&
              (titleEditing ? (
                <input
                  className="conv-title-edit"
                  autoFocus
                  onFocus={(e) => e.target.select()}
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
                    title={t("topbar.renameChat")}
                    onClick={() => { setTitleDraft(activeConversation.title); setTitleEditing(true); }}
                  >
                    {activeConversation.title}
                  </button>
                  <button className="btn-icon conv-title-caret" aria-label={t("menu.chatOptions")}
                    ref={titleMenuBtnRef}
                    aria-expanded={menuId === TOPBAR_MENU}
                    onClick={() => setMenuId(menuId === TOPBAR_MENU ? null : TOPBAR_MENU)}>
                    <Icon name="chev-d" className="icon-sm" />
                  </button>
                  {menuId === TOPBAR_MENU && (
                    <PortalMenu anchorRef={titleMenuBtnRef} align="left" className="conv-menu title-menu">
                      <ChatMenuItems conv={activeConversation} projects={chat.projects}
                        onAction={menuAction} onMove={moveConv} onCreate={createAndMove} />
                    </PortalMenu>
                  )}
                </div>
              ))}
            <div className="grow" />
            {/* The only control left in the bar, and it sits in the same corner
                the cross occupies in private mode: one place to switch the mode
                either way. */}
            <Tooltip label={t("topbar.privateChat")} keys={<Keys combo="ctrl+shift+p" />}
              placement="left">
              <button
                className={`private-toggle ${chat.privateMode ? "on" : ""}`}
                aria-label={t("topbar.privateChat")} aria-pressed={chat.privateMode}
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
                placeholder={t("sidebar.searchPlaceholder")}
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
              />
              <Tooltip label={t("sidebar.closeSearch")} placement="left">
                <button className="btn-icon" aria-label={t("sidebar.closeSearch")}
                  onClick={() => setSearchOpen(false)}>
                  <Icon name="x" className="icon-sm" />
                </button>
              </Tooltip>
            </div>
            <div className={`search-results ${hitsFade}`}
              ref={(el) => { resultsRef.current = el; hitsRef(el); }}>
              <div className="search-results-inner" ref={resultsInnerRef}>
                {searchHits.length === 0 && (
                  <p className="search-empty">{t("sidebar.nothingMatches", { q: convSearch })}</p>
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

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {langOpen && <LanguageDialog onClose={() => setLangOpen(false)} />}
      {openDoc && <DocumentDialog doc={openDoc} onClose={() => setOpenDoc(null)} />}

      {/* One picker for the whole sidebar, driven by the section's plus. */}
      <input ref={uploadRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) chat.uploadFile(f);
          e.target.value = "";
        }} />

      {pendingDelete && (
        <ConfirmModal
          title={t("dialog.deleteChatTitle")}
          text={t("dialog.deleteChatText")}
          okLabel={t("common.delete")}
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
