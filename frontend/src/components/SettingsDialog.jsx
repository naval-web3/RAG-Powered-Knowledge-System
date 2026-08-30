import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { CHAT_FONTS, getChatFont, setChatFont } from "../chatFont";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { getThemePref, setTheme } from "../theme";
import { initialsOf } from "../utils";
import ConfirmModal from "./ConfirmModal";
import Icon from "./Icon";

/* One entry per panel. `words` is what the rail's search matches on, so a
   setting can be found by what it does rather than by the heading it lives
   under -- "password" finds Account, "chunk" finds Model & retrieval. */
export const SECTIONS = [
  { id: "general", icon: "settings", label: "General", words: "profile name email instructions appearance theme font dark light" },
  { id: "account", icon: "user", label: "Account", words: "password sign out log out delete account id role member since" },
  { id: "privacy", icon: "shield", label: "Privacy", words: "data memory export clear history local ollama openai" },
  { id: "usage", icon: "activity", label: "Usage", words: "queries limits session weekly storage latency models" },
  { id: "knowledge", icon: "file", label: "Knowledge base", words: "documents chunks indexed ocr storage uploads pdf docx txt" },
  { id: "model", icon: "cpu", label: "Model & retrieval", words: "provider ollama openai temperature top-k chunk size overlap" },
];

function bytes(n) {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** A labelled row: title and optional description on the left, control right. */
function Row({ title, sub, children, stacked = false }) {
  return (
    <div className={`set-row ${stacked ? "stacked" : ""}`}>
      <div className="set-row-text">
        <div className="set-row-title">{title}</div>
        {sub && <div className="set-row-sub">{sub}</div>}
      </div>
      {children && <div className="set-row-ctl">{children}</div>}
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button className={`set-toggle ${on ? "on" : ""}`} role="switch" aria-checked={on}
      aria-label={label} onClick={() => onChange(!on)}>
      <span className="set-knob" />
    </button>
  );
}

/** A used/limit bar. The count is real; the ceiling is invented (see /api/usage). */
function Meter({ label, sub, used, limit, format = (n) => n }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="set-meter">
      <div className="set-meter-head">
        <div>
          <div className="set-row-title">{label}</div>
          {sub && <div className="set-row-sub">{sub}</div>}
        </div>
        <div className="set-meter-num">
          {format(used)} <span className="set-meter-of">of {format(limit)}</span>
        </div>
      </div>
      <div className="set-bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Fourteen days of query counts. Bars, because a count per day is discrete. */
function Spark({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="set-spark" role="img" aria-label={`Queries per day over ${days.length} days`}>
      {days.map((d) => (
        <span key={d.date} className="set-spark-bar" title={`${d.date}: ${d.count}`}>
          <span style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            className={d.count ? "" : "empty"} />
        </span>
      ))}
    </div>
  );
}

/* initialSection exists so the smoke test can render every panel: they are
   conditional, and a panel that never renders is a panel whose JSX is never
   evaluated -- exactly the blind spot the smoke test was written to close. */
export default function SettingsDialog({ onClose, initialSection = "general" }) {
  const { user, logout, updateUser } = useAuth();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [section, setSection] = useState(initialSection);
  const [railQuery, setRailQuery] = useState("");
  const paneRef = useRef(null);

  const [name, setName] = useState(user?.username || "");
  const [instructions, setInstructions] = useState(user?.custom_instructions || "");
  const [savedInstructions, setSavedInstructions] = useState(user?.custom_instructions || "");
  const [theme, setThemeState] = useState(getThemePref());
  const [font, setFontState] = useState(getChatFont());

  const [cfg, setCfg] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageAt, setUsageAt] = useState(null);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  /* Two switches that look like a memory feature and drive nothing: there is no
     cross-chat memory in this project. Kept in localStorage so at least they
     hold their position, and labelled in the panel as not yet wired. */
  const [memory, setMemory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("retrieva-memory-prefs")) || { search: true, generate: false };
    } catch {
      return { search: true, generate: false };
    }
  });
  function setMemoryPref(patch) {
    setMemory((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("retrieva-memory-prefs", JSON.stringify(next));
      } catch {
        /* private mode: it still toggles for this session */
      }
      return next;
    });
  }

  useEffect(() => {
    client.get("/api/settings").then(({ data }) => setCfg(data)).catch(() => {});
    // The stored user object predates custom_instructions for anyone signed in
    // before this shipped, so read the profile fresh rather than trusting it.
    client.get("/api/auth/me").then(({ data }) => {
      setInstructions(data.custom_instructions || "");
      setSavedInstructions(data.custom_instructions || "");
    }).catch(() => {});
  }, []);

  const loadUsage = useMemo(
    () => () => {
      client.get("/api/usage").then(({ data }) => {
        setUsage(data);
        setUsageAt(new Date());
      }).catch(() => {});
    },
    []
  );
  useEffect(() => {
    if (section === "usage" && !usage) loadUsage();
  }, [section, usage, loadUsage]);

  // Escape closes, and each panel starts at its own top.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [section]);

  const q = railQuery.trim().toLowerCase();
  const shown = q
    ? SECTIONS.filter((s) => `${s.label} ${s.words}`.toLowerCase().includes(q))
    : SECTIONS;

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean === user?.username) return;
    try {
      const { data } = await client.patch("/api/auth/me", { username: clean });
      updateUser({ username: data.username });
      toast("Name saved", "ok");
    } catch (err) {
      setName(user?.username || "");
      toast("Couldn't save your name", "err", err?.response?.data?.detail);
    }
  }

  async function saveInstructions() {
    try {
      const { data } = await client.patch("/api/auth/me", { custom_instructions: instructions });
      const stored = data.custom_instructions || "";
      setSavedInstructions(stored);
      updateUser({ custom_instructions: stored });
      toast(stored ? "Instructions saved" : "Instructions cleared", "ok");
    } catch (err) {
      toast("Couldn't save your instructions", "err", err?.response?.data?.detail);
    }
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
      toast("Configuration saved", "ok");
    } catch (err) {
      toast("Couldn't save configuration", "err", err?.response?.data?.detail);
    }
  }

  async function changePassword() {
    if (newPass.length < 6) { toast("New password must be at least 6 characters", "warn"); return; }
    try {
      await client.post("/api/auth/change-password", { current_password: oldPass, new_password: newPass });
      setOldPass(""); setNewPass("");
      toast("Password updated", "ok");
    } catch (err) {
      toast("Couldn't update password", "err", err?.response?.data?.detail);
    }
  }

  async function deleteAccount() {
    setConfirmDelete(false);
    try {
      await client.delete("/api/auth/account");
      logout();
      navigate("/welcome");
    } catch (err) {
      toast("Couldn't delete account", "err", err?.response?.data?.detail);
    }
  }

  /* Everything the account holds, as one JSON file: the profile, the document
     records, and every conversation with its messages. Assembled in the browser
     from endpoints that already exist rather than adding an export route. */
  async function exportData() {
    setExporting(true);
    try {
      const [me, docs, convs] = await Promise.all([
        client.get("/api/auth/me"),
        client.get("/api/documents"),
        client.get("/api/conversations"),
      ]);
      const full = await Promise.all(
        convs.data.map((c) =>
          client.get(`/api/conversations/${c.conversation_id}`).then((r) => r.data).catch(() => c)
        )
      );
      const blob = new Blob(
        [JSON.stringify({ exported_at: new Date().toISOString(), profile: me.data, documents: docs.data, conversations: full }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `retrieva-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded", "ok");
    } catch {
      toast("Couldn't build the export", "err");
    } finally {
      setExporting(false);
    }
  }

  const ollamaModels = chat.models.ollama.length ? chat.models.ollama : cfg ? [cfg.OLLAMA_MODEL] : [];
  const openaiModels = chat.models.openai.length ? chat.models.openai : cfg ? [cfg.OPENAI_CHAT_MODEL] : [];
  const docsDone = chat.docs.filter((d) => d.processing_status === "done");
  const byType = docsDone.reduce((acc, d) => ({ ...acc, [d.file_type]: (acc[d.file_type] || 0) + 1 }), {});

  return (
    <div className="modal-overlay set-overlay" onClick={onClose}>
      <div className="modal set-modal" role="dialog" aria-modal="true" aria-label="Settings"
        onClick={(e) => e.stopPropagation()}>

        <nav className="set-rail">
          <div className="set-rail-search">
            <Icon name="search" className="icon-sm" />
            <input value={railQuery} placeholder="Search"
              onChange={(e) => setRailQuery(e.target.value)} />
          </div>
          <div className="set-rail-scroll">
            <div className="set-rail-label">Settings</div>
            {shown.map((s) => (
              <button key={s.id} className={`set-rail-item ${section === s.id ? "active" : ""}`}
                onClick={() => setSection(s.id)}>
                <Icon name={s.icon} className="icon-sm" /> {s.label}
              </button>
            ))}
            {shown.length === 0 && <p className="set-rail-empty">Nothing matches.</p>}
            {isAdmin && !q && (
              <>
                <div className="set-rail-label">Platform</div>
                <button className="set-rail-item"
                  onClick={() => { onClose(); navigate("/dashboard"); }}>
                  <Icon name="grid" className="icon-sm" /> Admin dashboard
                  <Icon name="arrow-r" className="icon-sm set-rail-out" />
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="set-pane">
          <button className="btn-icon set-close" aria-label="Close settings" onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
          <div className="set-scroll" ref={paneRef}>

            {section === "general" && (
              <>
                <h3 className="set-h">Profile</h3>
                <Row title="Avatar" sub="Drawn from your name.">
                  <span className="avatar">{initialsOf(user?.username)}</span>
                </Row>
                <Row title="Display name">
                  <input className="set-input" value={name} onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                </Row>
                <Row title="Email" sub="Your sign-in identity, and not changeable here.">
                  <input className="set-input" value={user?.email || ""} disabled />
                </Row>

                <Row title="Instructions for Retrieva" stacked
                  sub="Kept in mind on every answer, in every chat. A project's own instructions come first, and neither can switch off answering from your documents.">
                  <textarea className="set-textarea" rows={4} value={instructions}
                    placeholder="e.g. answer in British English, and keep it under 150 words"
                    onChange={(e) => setInstructions(e.target.value)} />
                  <div className="set-actions">
                    {instructions !== savedInstructions && (
                      <button className="btn" onClick={() => setInstructions(savedInstructions)}>Cancel</button>
                    )}
                    <button className="btn btn-primary" onClick={saveInstructions}
                      disabled={instructions === savedInstructions}>Save</button>
                  </div>
                </Row>

                <h3 className="set-h">Preferences</h3>
                <Row title="Appearance">
                  <div className="set-seg">
                    {[["system", "monitor"], ["light", "sun"], ["dark", "moon"]].map(([val, ic]) => (
                      <button key={val} className={theme === val ? "active" : ""}
                        aria-label={val} title={val}
                        onClick={() => { setThemeState(val); setTheme(val); }}>
                        <Icon name={ic} className="icon-sm" />
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Chat font" sub="Answers and your own messages. The interface stays on Inter.">
                  <select className="set-select" value={font}
                    onChange={(e) => { setFontState(e.target.value); setChatFont(e.target.value); }}>
                    {CHAT_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Row>
              </>
            )}

            {section === "account" && (
              <>
                <h3 className="set-h">Account</h3>
                <Row title="Account ID">
                  <code className="set-chip">{user?.user_id}</code>
                </Row>
                <Row title="Role"><span className="set-value">{user?.role}</span></Row>
                <Row title="Member since"><span className="set-value">{when(user?.created_at)}</span></Row>

                <h3 className="set-h">Password</h3>
                <Row title="Current password">
                  <input className="set-input" type="password" autoComplete="current-password"
                    value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
                </Row>
                <Row title="New password" sub="At least 6 characters. Sessions already issued stay valid for their 24 hours.">
                  <div className="set-input-wrap">
                    <input className="set-input" type={showKey ? "text" : "password"} autoComplete="new-password"
                      value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                    <button className="btn-icon" aria-label={showKey ? "Hide" : "Show"}
                      onClick={() => setShowKey((v) => !v)}>
                      <Icon name={showKey ? "eye-off" : "eye"} className="icon-sm" />
                    </button>
                  </div>
                </Row>
                <div className="set-actions">
                  <button className="btn btn-primary" onClick={changePassword}
                    disabled={!oldPass || !newPass}>Update password</button>
                </div>

                <h3 className="set-h">Session</h3>
                <Row title="Sign out" sub="Clears the token held in this browser.">
                  <button className="btn" onClick={() => { logout(); navigate("/welcome"); }}>Sign out</button>
                </Row>
                <Row title="Delete account"
                  sub="Removes your account, documents, their indexed vectors and every chat. It cannot be undone.">
                  <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
                </Row>
              </>
            )}

            {section === "privacy" && (
              <>
                <h3 className="set-h">Privacy</h3>
                <p className="set-note">
                  Documents, their text and their embeddings stay on this machine: Postgres holds the
                  records, and the vectors sit in a Chroma store beside the app. Answers are generated
                  locally by Ollama unless you pick an OpenAI model, which is the one case where the
                  retrieved passages leave the machine.
                </p>

                <h3 className="set-h">Memory</h3>
                <Row title="Search and reference chats"
                  sub="Let Retrieva look through earlier conversations for context.">
                  <Toggle on={memory.search} label="Search and reference chats"
                    onChange={(v) => setMemoryPref({ search: v })} />
                </Row>
                <Row title="Generate memory from chats"
                  sub="Let Retrieva keep notes about you between conversations.">
                  <Toggle on={memory.generate} label="Generate memory from chats"
                    onChange={(v) => setMemoryPref({ generate: v })} />
                </Row>
                <p className="set-note set-note-warn">
                  Neither switch is wired to anything yet. Retrieval reads only the documents you
                  upload, one question at a time.
                </p>

                <h3 className="set-h">Your data</h3>
                <Row title="Export data"
                  sub="One JSON file with your profile, your document records and every conversation.">
                  <button className="btn" onClick={exportData} disabled={exporting}>
                    {exporting ? "Building…" : "Export data"}
                  </button>
                </Row>
                <Row title="Clear all conversations"
                  sub="Deletes every chat and its messages. Your documents stay indexed.">
                  <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear history</button>
                </Row>
              </>
            )}

            {section === "usage" && (
              <>
                <div className="set-h-row">
                  <h3 className="set-h">Plan usage limits</h3>
                  <span className="set-plan">Local tier</span>
                </div>
                {!usage && <p className="set-note">Reading your usage…</p>}
                {usage && (
                  <>
                    <Meter label="Current session"
                      sub={`Resets in ${Math.floor(usage.session.resets_in_minutes / 60)} hr ${usage.session.resets_in_minutes % 60} min`}
                      used={usage.session.used} limit={usage.session.limit}
                      format={(n) => `${n}`} />
                    <Meter label="This week" sub="Queries since Monday"
                      used={usage.week.used} limit={usage.week.limit} />
                    <Meter label="Storage" sub={`${usage.documents} documents · ${usage.chunks_indexed.toLocaleString()} chunks indexed`}
                      used={usage.storage.used} limit={usage.storage.limit} format={bytes} />
                    <p className="set-note set-note-warn">
                      The counts are yours, read from the query log. The ceilings are invented: this
                      project meters nothing and bills nobody.
                    </p>

                    <h3 className="set-h">Activity</h3>
                    <Row title="Queries per day" sub="Last 14 days" stacked>
                      <Spark days={usage.by_day} />
                    </Row>
                    <Row title="Queries all time"><span className="set-value">{usage.queries_total.toLocaleString()}</span></Row>
                    <Row title="Average response"><span className="set-value">{(usage.avg_response_ms / 1000).toFixed(1)}s</span></Row>
                    <Row title="Chunks retrieved"><span className="set-value">{usage.chunks_retrieved.toLocaleString()}</span></Row>

                    <h3 className="set-h">By model</h3>
                    {Object.entries(usage.by_model).sort((a, b) => b[1] - a[1]).map(([m, c]) => (
                      <Row key={m} title={m}><span className="set-value">{c.toLocaleString()}</span></Row>
                    ))}
                    {Object.keys(usage.by_model).length === 0 && (
                      <p className="set-note">Nothing asked yet.</p>
                    )}

                    <div className="set-updated">
                      Last updated: {usageAt ? usageAt.toLocaleTimeString() : "—"}
                      <button className="btn-icon" aria-label="Refresh usage" onClick={loadUsage}>
                        <Icon name="refresh" className="icon-sm" />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {section === "knowledge" && (
              <>
                <h3 className="set-h">Knowledge base</h3>
                <Row title="Indexed documents" sub="Only these are searched when you ask a question.">
                  <span className="set-value">{docsDone.length}</span>
                </Row>
                <Row title="Chunks indexed">
                  <span className="set-value">
                    {docsDone.reduce((n, d) => n + (d.chunk_count || 0), 0).toLocaleString()}
                  </span>
                </Row>
                <Row title="On disk">
                  <span className="set-value">{bytes(chat.docs.reduce((n, d) => n + (d.file_size || 0), 0))}</span>
                </Row>
                <Row title="By type">
                  <span className="set-value">
                    {Object.entries(byType).map(([t, c]) => `${c} ${t.toUpperCase()}`).join(" · ") || "—"}
                  </span>
                </Row>
                <p className="set-note">
                  PDF, DOCX and TXT are accepted. A scanned PDF with no text layer is put through OCR
                  on upload, which is slower than a born-digital file and only as good as the scan.
                </p>
                <div className="set-actions">
                  <button className="btn" onClick={() => { onClose(); navigate("/documents"); }}>
                    Manage documents
                  </button>
                </div>
              </>
            )}

            {section === "model" && (
              <>
                <h3 className="set-h">Model &amp; retrieval</h3>
                <p className="set-note">
                  {isAdmin
                    ? "These are the defaults for every chat. A chat can still pick a different model from the composer."
                    : "These are set by an administrator. You can still pick a different model per chat from the composer."}
                </p>
                {cfg && (
                  <>
                    <Row title="Default provider" stacked>
                      <div className="provider-cards">
                        <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "ollama" ? "selected" : ""}`}>
                          <input type="radio" name="set-provider" value="ollama" disabled={!isAdmin}
                            checked={cfg.DEFAULT_LLM_PROVIDER === "ollama"}
                            onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "ollama" })} />
                          <span className="p-icon"><Icon name="server" className="icon-sm" /></span>
                          <span><span className="p-name">Ollama</span>
                            <span className="p-desc">On this machine · {cfg.ollama_base_url}</span></span>
                        </label>
                        <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "openai" ? "selected" : ""}`}>
                          <input type="radio" name="set-provider" value="openai" disabled={!isAdmin}
                            checked={cfg.DEFAULT_LLM_PROVIDER === "openai"}
                            onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "openai" })} />
                          <span className="p-icon"><Icon name="cloud" className="icon-sm" /></span>
                          <span><span className="p-name">OpenAI</span>
                            <span className="p-desc">Cloud {cfg.openai_enabled ? "" : "· no API key set"}</span></span>
                        </label>
                      </div>
                    </Row>
                    <Row title="Ollama model">
                      <select className="set-select" value={cfg.OLLAMA_MODEL} disabled={!isAdmin}
                        onChange={(e) => setCfg({ ...cfg, OLLAMA_MODEL: e.target.value })}>
                        {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Row>
                    <Row title="OpenAI model">
                      <select className="set-select" value={cfg.OPENAI_CHAT_MODEL} disabled={!isAdmin}
                        onChange={(e) => setCfg({ ...cfg, OPENAI_CHAT_MODEL: e.target.value })}>
                        {openaiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Row>
                    <Row title="Temperature" sub="Higher wanders further from the passages.">
                      <div className="set-range">
                        <input type="range" min="0" max="1" step="0.1" disabled={!isAdmin}
                          value={cfg.LLM_TEMPERATURE}
                          onChange={(e) => setCfg({ ...cfg, LLM_TEMPERATURE: parseFloat(e.target.value) })} />
                        <span className="set-range-val">{Number(cfg.LLM_TEMPERATURE).toFixed(1)}</span>
                      </div>
                    </Row>
                    <Row title="Chunks retrieved" sub="How many passages are put in front of the model.">
                      <div className="set-range">
                        <input type="range" min="1" max="10" step="1" disabled={!isAdmin}
                          value={cfg.RETRIEVAL_TOP_K}
                          onChange={(e) => setCfg({ ...cfg, RETRIEVAL_TOP_K: parseInt(e.target.value, 10) })} />
                        <span className="set-range-val">{cfg.RETRIEVAL_TOP_K}</span>
                      </div>
                    </Row>
                    <Row title="Chunk size" sub="Characters per chunk. Only affects documents indexed from now on.">
                      <input className="set-input set-input-sm" type="number" min="200" max="4000" step="50"
                        disabled={!isAdmin} value={cfg.CHUNK_SIZE}
                        onChange={(e) => setCfg({ ...cfg, CHUNK_SIZE: parseInt(e.target.value, 10) || 0 })} />
                    </Row>
                    <Row title="Chunk overlap" sub="Characters shared between neighbours, so a sentence is not cut in half.">
                      <input className="set-input set-input-sm" type="number" min="0" max="1000" step="10"
                        disabled={!isAdmin} value={cfg.CHUNK_OVERLAP}
                        onChange={(e) => setCfg({ ...cfg, CHUNK_OVERLAP: parseInt(e.target.value, 10) || 0 })} />
                    </Row>
                    {isAdmin && (
                      <div className="set-actions">
                        <button className="btn btn-primary" onClick={saveConfig}>Save configuration</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmClear && (
        <ConfirmModal
          title="Clear all conversations?"
          text="Every chat and its messages will be permanently deleted. This cannot be undone."
          okLabel="Clear history"
          onConfirm={() => { setConfirmClear(false); chat.clearAllConversations(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete your account?"
          text="This permanently removes your account, your documents, their indexed vectors and your chat history. It cannot be undone."
          okLabel="Delete account"
          onConfirm={deleteAccount}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
