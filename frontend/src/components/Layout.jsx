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
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-lg font-bold tracking-tight text-move-gradient">RAG Knowledge</span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                <IconChat className="w-4 h-4" /> Chat
              </NavLink>
              <NavLink to="/documents" className={linkClass}>
                <IconDoc className="w-4 h-4" /> Documents
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/admin" className={linkClass}>
                  <IconChart className="w-4 h-4" /> Admin
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncognito((v) => !v)}
              title={
                incognito
                  ? "Incognito on — this chat isn't saved to history"
                  : "Start a private (incognito) chat"
              }
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
                incognito ? "bg-move/20 text-move" : "text-muted hover:text-white hover:bg-surface"
              }`}
            >
              <IconGhost className="w-4 h-4" />
              {incognito ? "Incognito" : "Private"}
            </button>
            <span className="text-sm text-muted">
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
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-surface text-muted hover:text-white hover:bg-surface2 transition-colors"
            >
              <IconLogout className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 w-full px-6 py-5 overflow-auto">
        <Outlet context={{ incognito, setIncognito }} />
      </main>
    </div>
  );
}
