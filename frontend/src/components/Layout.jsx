import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconChat, IconChart, IconDoc, IconGhost, IconLogout, IconSettings } from "./icons";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onSettings = location.pathname === "/settings";
  const [incognito, setIncognito] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      isActive ? "bg-surface2 text-white" : "text-muted hover:text-white hover:bg-surface"
    }`;

  return (
    <div className="h-screen flex flex-col bg-ink overflow-hidden">
      <header className="bg-ink/80 backdrop-blur border-b border-hairline shrink-0">
        <div className="w-full px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-5 min-w-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-move-gradient whitespace-nowrap">
              RAG<span className="hidden sm:inline"> Knowledge</span>
            </span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                <IconChat className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Chat</span>
              </NavLink>
              <NavLink to="/documents" className={linkClass}>
                <IconDoc className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Documents</span>
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/admin" className={linkClass}>
                  <IconChart className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Admin</span>
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setIncognito((v) => !v)}
              title={
                incognito
                  ? "Incognito on — this chat isn't saved to history"
                  : "Start a private (incognito) chat"
              }
              className={`flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-full transition-colors ${
                incognito ? "bg-move/20 text-move" : "text-muted hover:text-white hover:bg-surface"
              }`}
            >
              <IconGhost className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{incognito ? "Incognito" : "Private"}</span>
            </button>
            <span className="hidden lg:inline text-sm text-muted whitespace-nowrap">
              {user?.username} <span className="text-move">·</span> {user?.role}
            </span>
            <button
              onClick={() => (onSettings ? navigate(-1) : navigate("/settings"))}
              title={onSettings ? "Close settings" : "Settings"}
              className={`p-2 rounded-full transition-colors ${
                onSettings ? "bg-surface2 text-white" : "text-muted hover:text-white hover:bg-surface"
              }`}
            >
              <IconSettings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-full bg-surface text-muted hover:text-white hover:bg-surface2 transition-colors"
            >
              <IconLogout className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 w-full px-3 sm:px-6 py-4 sm:py-5 overflow-auto">
        <Outlet context={{ incognito, setIncognito }} />
      </main>
    </div>
  );
}
