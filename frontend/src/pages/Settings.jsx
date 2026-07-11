import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { getThemePref, setTheme } from "../theme";

const NAV = [
  { id: "set-profile", icon: "user", label: "Profile" },
  { id: "set-appearance", icon: "sun", label: "Appearance" },
  { id: "set-llm", icon: "cpu", label: "Model & retrieval" },
  { id: "set-security", icon: "key", label: "Security" },
  { id: "set-danger", icon: "alert", label: "Danger zone" },
];

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [active, setActive] = useState("set-profile");
  const [name, setName] = useState(user?.username || "");
  const [theme, setThemeState] = useState(getThemePref());

  const [cfg, setCfg] = useState(null);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    client.get("/api/settings").then(({ data }) => setCfg(data)).catch(() => {});
  }, []);

  function scrollTo(id) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProfile() {
    try {
      const { data } = await client.patch("/api/auth/me", { username: name.trim() });
      updateUser({ username: data.username });
      toast("Profile saved.", "ok");
    } catch (err) {
      toast("Couldn't save profile.", "err", err?.response?.data?.detail);
    }
  }

  function changeTheme(pref) {
    setThemeState(pref);
    setTheme(pref);
  }

  async function saveConfig() {
    try {
      const { data } = await client.patch("/api/settings", {
        DEFAULT_LLM_PROVIDER: cfg.DEFAULT_LLM_PROVIDER,
        OLLAMA_MODEL: cfg.OLLAMA_MODEL,
        OPENAI_CHAT_MODEL: cfg.OPENAI_CHAT_MODEL,
        RETRIEVAL_TOP_K: cfg.RETRIEVAL_TOP_K,
        LLM_TEMPERATURE: cfg.LLM_TEMPERATURE,
        CHUNK_SIZE: cfg.CHUNK_SIZE,
        CHUNK_OVERLAP: cfg.CHUNK_OVERLAP,
      });
      setCfg(data);
      toast("Configuration saved.", "ok");
    } catch (err) {
      toast("Couldn't save configuration.", "err", err?.response?.data?.detail);
    }
  }

  async function changePassword() {
    if (newPass.length < 6) { toast("New password must be at least 6 characters.", "warn"); return; }
    try {
      await client.post("/api/auth/change-password", { current_password: oldPass, new_password: newPass });
      setOldPass(""); setNewPass("");
      toast("Password updated.", "ok");
    } catch (err) {
      toast("Couldn't update password.", "err", err?.response?.data?.detail);
    }
  }

  async function deleteAccount() {
    setConfirmDelete(false);
    try {
      await client.delete("/api/auth/account");
      logout();
      navigate("/welcome");
    } catch (err) {
      toast("Couldn't delete account.", "err", err?.response?.data?.detail);
    }
  }

  const ollamaModels = chat.models.ollama.length ? chat.models.ollama : cfg ? [cfg.OLLAMA_MODEL] : [];
  const openaiModels = chat.models.openai.length ? chat.models.openai : cfg ? [cfg.OPENAI_CHAT_MODEL] : [];

  return (
    <div className="page">
      <div className="page-pad">
        <h2 className="page-title">Settings</h2>
        <p className="page-sub">Profile, appearance and retrieval configuration.</p>

        <div className="settings-grid">
          <nav className="settings-nav">
            {NAV.map((n) => (
              <button key={n.id} className={`sb-item ${active === n.id ? "active" : ""}`} onClick={() => scrollTo(n.id)}>
                <Icon name={n.icon} className="icon-sm" /> {n.label}
              </button>
            ))}
          </nav>

          <div>
            {/* Profile */}
            <div className="set-card" id="set-profile">
              <h2>Profile</h2>
              <p className="c-sub">How you appear across the workspace.</p>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="set-username">Display name</label>
                  <input className="input" id="set-username" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="set-email">Email address</label>
                  <input className="input" id="set-email" value={user?.email || ""} disabled title="Email is your login identity" />
                </div>
              </div>
              <div className="save-row">
                <button className="btn btn-primary" onClick={saveProfile} disabled={!name.trim() || name.trim() === user?.username}>
                  Save profile
                </button>
              </div>
            </div>

            {/* Appearance */}
            <div className="set-card" id="set-appearance">
              <h2>Appearance</h2>
              <p className="c-sub">Theme preference for this device.</p>
              <div className="radio-tile-row">
                {[["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "panel", "System"]].map(([val, ic, lbl]) => (
                  <label className="radio-tile" key={val}>
                    <input type="radio" name="theme" value={val} checked={theme === val} onChange={() => changeTheme(val)} />
                    <span><Icon name={ic} className="icon-sm" /> {lbl}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Model & retrieval */}
            <div className="set-card" id="set-llm">
              <h2>Model &amp; retrieval</h2>
              <p className="c-sub">
                Choose the default LLM provider and tune the RAG pipeline.
                {!isAdmin && " These are managed by an administrator."}
              </p>
              {cfg && (
                <>
                  <div className="provider-cards">
                    <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "openai" ? "selected" : ""}`}>
                      <input type="radio" name="provider" value="openai" disabled={!isAdmin}
                        checked={cfg.DEFAULT_LLM_PROVIDER === "openai"}
                        onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "openai" })} />
                      <span className="p-icon"><Icon name="cloud" className="icon-sm" /></span>
                      <span><span className="p-name">OpenAI</span><span className="p-desc">Cloud inference · GPT-4 family {cfg.openai_enabled ? "" : "(no API key)"}</span></span>
                    </label>
                    <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "ollama" ? "selected" : ""}`}>
                      <input type="radio" name="provider" value="ollama" disabled={!isAdmin}
                        checked={cfg.DEFAULT_LLM_PROVIDER === "ollama"}
                        onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "ollama" })} />
                      <span className="p-icon"><Icon name="server" className="icon-sm" /></span>
                      <span><span className="p-name">Ollama</span><span className="p-desc">Local inference · {cfg.ollama_base_url}</span></span>
                    </label>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="set-ollama-model">Ollama model</label>
                      <select className="select" id="set-ollama-model" value={cfg.OLLAMA_MODEL} disabled={!isAdmin}
                        onChange={(e) => setCfg({ ...cfg, OLLAMA_MODEL: e.target.value })}>
                        {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="set-openai-model">OpenAI model</label>
                      <select className="select" id="set-openai-model" value={cfg.OPENAI_CHAT_MODEL} disabled={!isAdmin}
                        onChange={(e) => setCfg({ ...cfg, OPENAI_CHAT_MODEL: e.target.value })}>
                        {openaiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="set-temp">Temperature · <span className="mono-cell">{Number(cfg.LLM_TEMPERATURE).toFixed(1)}</span></label>
                      <input className="range" type="range" id="set-temp" min="0" max="1" step="0.1" disabled={!isAdmin}
                        value={cfg.LLM_TEMPERATURE} onChange={(e) => setCfg({ ...cfg, LLM_TEMPERATURE: parseFloat(e.target.value) })} />
                    </div>
                    <div className="field">
                      <label htmlFor="set-topk">Top-k chunks · <span className="mono-cell">{cfg.RETRIEVAL_TOP_K}</span></label>
                      <input className="range" type="range" id="set-topk" min="1" max="10" step="1" disabled={!isAdmin}
                        value={cfg.RETRIEVAL_TOP_K} onChange={(e) => setCfg({ ...cfg, RETRIEVAL_TOP_K: parseInt(e.target.value, 10) })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="set-chunk">Chunk size (chars)</label>
                      <input className="input" type="number" id="set-chunk" min="200" max="4000" step="50" disabled={!isAdmin}
                        value={cfg.CHUNK_SIZE} onChange={(e) => setCfg({ ...cfg, CHUNK_SIZE: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                    <div className="field">
                      <label htmlFor="set-overlap">Chunk overlap (chars)</label>
                      <input className="input" type="number" id="set-overlap" min="0" max="1000" step="10" disabled={!isAdmin}
                        value={cfg.CHUNK_OVERLAP} onChange={(e) => setCfg({ ...cfg, CHUNK_OVERLAP: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="save-row"><button className="btn btn-primary" onClick={saveConfig}>Save configuration</button></div>
                  )}
                </>
              )}
            </div>

            {/* Security */}
            <div className="set-card" id="set-security">
              <h2>Security</h2>
              <p className="c-sub">JWT sessions expire after 24 h. Passwords are bcrypt-hashed server-side.</p>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="set-pass-old">Current password</label>
                  <input className="input" type="password" id="set-pass-old" autoComplete="current-password"
                    value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="set-pass-new">New password</label>
                  <div className="input-wrap">
                    <input className="input" type={showKey ? "text" : "password"} id="set-pass-new" autoComplete="new-password"
                      value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                    <button type="button" className="btn-icon trail" aria-label="Show" onClick={() => setShowKey((s) => !s)}>
                      <Icon name={showKey ? "eye-off" : "eye"} className="icon-sm" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="save-row">
                <button className="btn btn-primary" onClick={changePassword} disabled={!oldPass || !newPass}>Update password</button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="set-card danger-card" id="set-danger">
              <h2>Danger zone</h2>
              <p className="c-sub">Irreversible actions. Tread carefully.</p>
              <div className="danger-row">
                <div><div className="d-t">Clear all conversations</div><div className="d-s">Deletes every chat session and message for this account.</div></div>
                <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear history</button>
              </div>
              <div className="danger-row">
                <div><div className="d-t">Delete account</div><div className="d-s">Permanently removes your account, documents, vectors and history.</div></div>
                <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmClear && (
        <ConfirmModal
          title="Clear all conversations?"
          text="Every chat session and its messages will be permanently deleted. This cannot be undone."
          okLabel="Clear history"
          onConfirm={() => { setConfirmClear(false); chat.clearAllConversations(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete your account?"
          text="This permanently removes your account and all associated data — documents, indexed vectors, and chat history. This cannot be undone."
          okLabel="Delete account"
          onConfirm={deleteAccount}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
