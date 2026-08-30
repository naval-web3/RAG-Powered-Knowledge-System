import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { CHAT_FONTS, getChatFont, setChatFont } from "../chatFont";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import { getThemePref, setTheme } from "../theme";
import { initialsOf } from "../utils";
import ConfirmModal from "./ConfirmModal";
import Icon from "./Icon";
import Select from "./Select";
import Tooltip from "./Tooltip";

/* One entry per panel. The label is nav.<id> and the search blob is
   nav.<id>Words, both translated: the rail's search should find a setting by
   what it does in the reader's own language -- "password" finds Account,
   "chunk" finds Model & retrieval. */
export const SECTIONS = [
  { id: "general", icon: "settings" },
  { id: "account", icon: "user" },
  { id: "privacy", icon: "shield" },
  { id: "usage", icon: "activity" },
  { id: "knowledge", icon: "file" },
  { id: "model", icon: "cpu" },
];

/* Ids are fixed and English; the labels come from work.<id>. The order is the
   one the picker shows, study first, because that is who uses this. */
export const WORK_ROLES = [
  "student", "research", "teaching",
  "engineering", "product", "design", "data_science",
  "marketing", "sales", "operations", "finance",
  "hr", "legal", "support", "healthcare", "other",
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
  const t = useT();
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="set-meter">
      <div className="set-meter-head">
        <div>
          <div className="set-row-title">{label}</div>
          {sub && <div className="set-row-sub">{sub}</div>}
        </div>
        <div className="set-meter-num">
          {format(used)}{" "}
          <span className="set-meter-of">{t("settings.meterOf", { limit: format(limit) })}</span>
        </div>
      </div>
      <div className="set-bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Fourteen days of query counts. Bars, because a count per day is discrete. */
function Spark({ days }) {
  const t = useT();
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="set-spark" role="img" aria-label={t("settings.sparkAria", { n: days.length })}>
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
  const t = useT();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [section, setSection] = useState(initialSection);
  const [railQuery, setRailQuery] = useState("");
  const paneRef = useRef(null);

  const [name, setName] = useState(user?.username || "");
  const [work, setWork] = useState(user?.work_role || "");
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
      setWork(data.work_role || "");
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
    ? SECTIONS.filter((s) =>
        `${t(`nav.${s.id}`)} ${t(`nav.${s.id}Words`)}`.toLowerCase().includes(q)
      )
    : SECTIONS;

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean === user?.username) return;
    try {
      const { data } = await client.patch("/api/auth/me", { username: clean });
      updateUser({ username: data.username });
      toast(t("settings.nameSaved"), "ok");
    } catch (err) {
      setName(user?.username || "");
      toast(t("settings.nameSaveFailed"), "err", err?.response?.data?.detail);
    }
  }

  /* Saved on change rather than behind a button: it is one choice from a fixed
     list, so there is nothing to review before committing it. */
  async function saveWork(role) {
    const previous = work;
    setWork(role);
    try {
      const { data } = await client.patch("/api/auth/me", { work_role: role });
      updateUser({ work_role: data.work_role || "" });
    } catch (err) {
      setWork(previous);
      toast(t("settings.nameSaveFailed"), "err", err?.response?.data?.detail);
    }
  }

  async function saveInstructions() {
    try {
      const { data } = await client.patch("/api/auth/me", { custom_instructions: instructions });
      const stored = data.custom_instructions || "";
      setSavedInstructions(stored);
      updateUser({ custom_instructions: stored });
      toast(stored ? t("settings.instructionsSaved") : t("settings.instructionsCleared"), "ok");
    } catch (err) {
      toast(t("settings.instructionsFailed"), "err", err?.response?.data?.detail);
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
      toast(t("settings.configSaved"), "ok");
    } catch (err) {
      toast(t("settings.configFailed"), "err", err?.response?.data?.detail);
    }
  }

  async function changePassword() {
    if (newPass.length < 6) { toast(t("settings.passwordTooShort"), "warn"); return; }
    try {
      await client.post("/api/auth/change-password", { current_password: oldPass, new_password: newPass });
      setOldPass(""); setNewPass("");
      toast(t("settings.passwordUpdated"), "ok");
    } catch (err) {
      toast(t("settings.passwordFailed"), "err", err?.response?.data?.detail);
    }
  }

  async function deleteAccount() {
    setConfirmDelete(false);
    try {
      await client.delete("/api/auth/account");
      logout();
      navigate("/welcome");
    } catch (err) {
      toast(t("settings.deleteAccountFailed"), "err", err?.response?.data?.detail);
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
      toast(t("settings.exportDone"), "ok");
    } catch {
      toast(t("settings.exportFailed"), "err");
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
      <div className="modal set-modal" role="dialog" aria-modal="true" aria-label={t("common.settings")}
        onClick={(e) => e.stopPropagation()}>

        <nav className="set-rail">
          <div className="set-rail-search">
            <Icon name="search" className="icon-sm" />
            <input value={railQuery} placeholder={t("common.search")}
              onChange={(e) => setRailQuery(e.target.value)} />
          </div>
          <div className="set-rail-scroll">
            <div className="set-rail-label">{t("common.settings")}</div>
            {shown.map((s) => (
              <button key={s.id} className={`set-rail-item ${section === s.id ? "active" : ""}`}
                onClick={() => setSection(s.id)}>
                <Icon name={s.icon} className="icon-sm" /> {t(`nav.${s.id}`)}
              </button>
            ))}
            {shown.length === 0 && <p className="set-rail-empty">{t("settings.railEmpty")}</p>}
            {isAdmin && !q && (
              <>
                <div className="set-rail-label">{t("settings.platform")}</div>
                <button className="set-rail-item"
                  onClick={() => { onClose(); navigate("/dashboard"); }}>
                  <Icon name="grid" className="icon-sm" /> {t("settings.adminDashboard")}
                  <Icon name="arrow-r" className="icon-sm set-rail-out" />
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="set-pane">
          <Tooltip label={t("common.close")} placement="left">
            <button className="btn-icon set-close" aria-label={t("common.close")} onClick={onClose}>
              <Icon name="x" className="icon-sm" />
            </button>
          </Tooltip>
          <div className="set-scroll" ref={paneRef}>

            {section === "general" && (
              <>
                <h3 className="set-h">{t("settings.profile")}</h3>
                <Row title={t("settings.avatar")} sub={t("settings.avatarSub")}>
                  <span className="avatar">{initialsOf(user?.username)}</span>
                </Row>
                <Row title={t("settings.displayName")}>
                  <input className="set-input" value={name} onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                </Row>
                <Row title={t("settings.email")} sub={t("settings.emailSub")}>
                  <input className="set-input" value={user?.email || ""} disabled />
                </Row>

                <Row title={t("settings.work")}>
                  <Select
                    value={work}
                    ariaLabel={t("settings.work")}
                    onChange={saveWork}
                    options={[
                      { value: "", label: t("settings.workNone") },
                      ...WORK_ROLES.map((r) => ({ value: r, label: t(`work.${r}`) })),
                    ]}
                  />
                </Row>

                <Row title={t("settings.instructions")} stacked sub={t("settings.instructionsSub")}>
                  <textarea className="set-textarea" rows={4} value={instructions}
                    placeholder={t("settings.instructionsPlaceholder")}
                    onChange={(e) => setInstructions(e.target.value)} />
                  <div className="set-actions">
                    {instructions !== savedInstructions && (
                      <button className="btn" onClick={() => setInstructions(savedInstructions)}>{t("common.cancel")}</button>
                    )}
                    <button className="btn btn-primary" onClick={saveInstructions}
                      disabled={instructions === savedInstructions}>{t("settings.save")}</button>
                  </div>
                </Row>

                <h3 className="set-h">{t("settings.preferences")}</h3>
                <Row title={t("common.appearance")}>
                  <div className="set-seg">
                    {[["system", "monitor"], ["light", "sun"], ["dark", "moon"]].map(([val, ic]) => (
                      <Tooltip key={val} label={t(`theme.${val}`)}>
                        <button className={theme === val ? "active" : ""}
                          aria-label={t(`theme.${val}`)}
                          onClick={() => { setThemeState(val); setTheme(val); }}>
                          <Icon name={ic} className="icon-sm" />
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                </Row>
                <Row title={t("settings.chatFont")} sub={t("settings.chatFontSub")}>
                  <Select
                    value={font}
                    ariaLabel={t("settings.chatFont")}
                    onChange={(v) => { setFontState(v); setChatFont(v); }}
                    options={CHAT_FONTS.map((f) => ({ value: f.id, label: t(`font.${f.id}`) }))}
                  />
                </Row>
              </>
            )}

            {section === "account" && (
              <>
                <h3 className="set-h">{t("settings.account")}</h3>
                <Row title={t("settings.accountId")}>
                  <code className="set-chip">{user?.user_id}</code>
                </Row>
                <Row title={t("settings.role")}><span className="set-value">{user?.role}</span></Row>
                <Row title={t("settings.memberSince")}><span className="set-value">{when(user?.created_at)}</span></Row>

                <h3 className="set-h">{t("settings.password")}</h3>
                <Row title={t("settings.currentPassword")}>
                  <input className="set-input" type="password" autoComplete="current-password"
                    value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
                </Row>
                <Row title={t("settings.newPassword")} sub={t("settings.newPasswordSub")}>
                  <div className="set-input-wrap">
                    <input className="set-input" type={showKey ? "text" : "password"} autoComplete="new-password"
                      value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                    <Tooltip label={showKey ? t("settings.hide") : t("settings.show")}
                      placement="left">
                      <button className="btn-icon"
                        aria-label={showKey ? t("settings.hide") : t("settings.show")}
                        onClick={() => setShowKey((v) => !v)}>
                        <Icon name={showKey ? "eye-off" : "eye"} className="icon-sm" />
                      </button>
                    </Tooltip>
                  </div>
                </Row>
                <div className="set-actions">
                  <button className="btn btn-primary" onClick={changePassword}
                    disabled={!oldPass || !newPass}>{t("settings.updatePassword")}</button>
                </div>

                <h3 className="set-h">{t("settings.session")}</h3>
                <Row title={t("common.signOut")} sub={t("settings.signOutSub")}>
                  <button className="btn" onClick={() => { logout(); navigate("/welcome"); }}>{t("common.signOut")}</button>
                </Row>
                <Row title={t("settings.deleteAccount")} sub={t("settings.deleteAccountSub")}>
                  <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>{t("settings.deleteAccount")}</button>
                </Row>
              </>
            )}

            {section === "privacy" && (
              <>
                <h3 className="set-h">{t("settings.privacy")}</h3>
                <p className="set-note">{t("settings.privacyNote")}</p>

                <h3 className="set-h">{t("settings.memory")}</h3>
                <Row title={t("settings.memorySearch")} sub={t("settings.memorySearchSub")}>
                  <Toggle on={memory.search} label={t("settings.memorySearch")}
                    onChange={(v) => setMemoryPref({ search: v })} />
                </Row>
                <Row title={t("settings.memoryGenerate")} sub={t("settings.memoryGenerateSub")}>
                  <Toggle on={memory.generate} label={t("settings.memoryGenerate")}
                    onChange={(v) => setMemoryPref({ generate: v })} />
                </Row>
                <p className="set-note set-note-warn">{t("settings.memoryNote")}</p>

                <h3 className="set-h">{t("settings.yourData")}</h3>
                <Row title={t("settings.exportData")} sub={t("settings.exportDataSub")}>
                  <button className="btn" onClick={exportData} disabled={exporting}>
                    {exporting ? t("settings.exporting") : t("settings.exportData")}
                  </button>
                </Row>
                <Row title={t("settings.clearAll")} sub={t("settings.clearAllSub")}>
                  <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>{t("settings.clearHistory")}</button>
                </Row>
              </>
            )}

            {section === "usage" && (
              <>
                <div className="set-h-row">
                  <h3 className="set-h">{t("settings.planLimits")}</h3>
                  <span className="set-plan">{t("settings.planName")}</span>
                </div>
                {!usage && <p className="set-note">{t("settings.readingUsage")}</p>}
                {usage && (
                  <>
                    <Meter label={t("settings.currentSession")}
                      sub={t("settings.resetsIn", {
                        h: Math.floor(usage.session.resets_in_minutes / 60),
                        m: usage.session.resets_in_minutes % 60,
                      })}
                      used={usage.session.used} limit={usage.session.limit}
                      format={(n) => `${n}`} />
                    <Meter label={t("settings.thisWeek")} sub={t("settings.sinceMonday")}
                      used={usage.week.used} limit={usage.week.limit} />
                    <Meter label={t("settings.storage")}
                      sub={t("settings.storageSub", {
                        docs: usage.documents,
                        chunks: usage.chunks_indexed.toLocaleString(),
                      })}
                      used={usage.storage.used} limit={usage.storage.limit} format={bytes} />
                    <p className="set-note set-note-warn">{t("settings.usageNote")}</p>

                    <h3 className="set-h">{t("settings.activity")}</h3>
                    <Row title={t("settings.queriesPerDay")} sub={t("settings.last14Days")} stacked>
                      <Spark days={usage.by_day} />
                    </Row>
                    <Row title={t("settings.queriesAllTime")}><span className="set-value">{usage.queries_total.toLocaleString()}</span></Row>
                    <Row title={t("settings.avgResponse")}><span className="set-value">{(usage.avg_response_ms / 1000).toFixed(1)}s</span></Row>
                    <Row title={t("settings.chunksRetrieved")}><span className="set-value">{usage.chunks_retrieved.toLocaleString()}</span></Row>

                    <h3 className="set-h">{t("settings.byModel")}</h3>
                    {Object.entries(usage.by_model).sort((a, b) => b[1] - a[1]).map(([m, c]) => (
                      <Row key={m} title={m}><span className="set-value">{c.toLocaleString()}</span></Row>
                    ))}
                    {Object.keys(usage.by_model).length === 0 && (
                      <p className="set-note">{t("settings.nothingAsked")}</p>
                    )}

                    <div className="set-updated">
                      {t("settings.lastUpdated", { time: usageAt ? usageAt.toLocaleTimeString() : "—" })}
                      <Tooltip label={t("settings.refreshUsage")} placement="top">
                        <button className="btn-icon" aria-label={t("settings.refreshUsage")}
                          onClick={loadUsage}>
                          <Icon name="refresh" className="icon-sm" />
                        </button>
                      </Tooltip>
                    </div>
                  </>
                )}
              </>
            )}

            {section === "knowledge" && (
              <>
                <h3 className="set-h">{t("settings.knowledge")}</h3>
                <Row title={t("settings.indexedDocs")} sub={t("settings.indexedDocsSub")}>
                  <span className="set-value">{docsDone.length}</span>
                </Row>
                <Row title={t("settings.chunksIndexed")}>
                  <span className="set-value">
                    {docsDone.reduce((n, d) => n + (d.chunk_count || 0), 0).toLocaleString()}
                  </span>
                </Row>
                <Row title={t("settings.onDisk")}>
                  <span className="set-value">{bytes(chat.docs.reduce((n, d) => n + (d.file_size || 0), 0))}</span>
                </Row>
                <Row title={t("settings.byType")}>
                  <span className="set-value">
                    {Object.entries(byType).map(([t, c]) => `${c} ${t.toUpperCase()}`).join(" · ") || "—"}
                  </span>
                </Row>
                <p className="set-note">{t("settings.ocrNote")}</p>
                <div className="set-actions">
                  <button className="btn" onClick={() => { onClose(); navigate("/documents"); }}>
                    {t("settings.manageDocs")}
                  </button>
                </div>
              </>
            )}

            {section === "model" && (
              <>
                <h3 className="set-h">{t("settings.modelRetrieval")}</h3>
                <p className="set-note">
                  {isAdmin ? t("settings.modelNoteAdmin") : t("settings.modelNoteUser")}
                </p>
                {cfg && (
                  <>
                    <Row title={t("settings.defaultProvider")} stacked>
                      <div className="provider-cards">
                        <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "ollama" ? "selected" : ""}`}>
                          <input type="radio" name="set-provider" value="ollama" disabled={!isAdmin}
                            checked={cfg.DEFAULT_LLM_PROVIDER === "ollama"}
                            onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "ollama" })} />
                          <span className="p-icon"><Icon name="server" className="icon-sm" /></span>
                          <span><span className="p-name">Ollama</span>
                            <span className="p-desc">{t("settings.onThisMachine")} · {cfg.ollama_base_url}</span></span>
                        </label>
                        <label className={`provider-card ${cfg.DEFAULT_LLM_PROVIDER === "openai" ? "selected" : ""}`}>
                          <input type="radio" name="set-provider" value="openai" disabled={!isAdmin}
                            checked={cfg.DEFAULT_LLM_PROVIDER === "openai"}
                            onChange={() => setCfg({ ...cfg, DEFAULT_LLM_PROVIDER: "openai" })} />
                          <span className="p-icon"><Icon name="cloud" className="icon-sm" /></span>
                          <span><span className="p-name">OpenAI</span>
                            <span className="p-desc">{t("settings.cloud")}{cfg.openai_enabled ? "" : ` · ${t("settings.noApiKey")}`}</span></span>
                        </label>
                      </div>
                    </Row>
                    <Row title={t("settings.ollamaModel")}>
                      <Select
                        value={cfg.OLLAMA_MODEL}
                        ariaLabel={t("settings.ollamaModel")}
                        disabled={!isAdmin}
                        onChange={(v) => setCfg({ ...cfg, OLLAMA_MODEL: v })}
                        options={ollamaModels.map((m) => ({ value: m, label: m }))}
                      />
                    </Row>
                    <Row title={t("settings.openaiModel")}>
                      <Select
                        value={cfg.OPENAI_CHAT_MODEL}
                        ariaLabel={t("settings.openaiModel")}
                        disabled={!isAdmin}
                        onChange={(v) => setCfg({ ...cfg, OPENAI_CHAT_MODEL: v })}
                        options={openaiModels.map((m) => ({ value: m, label: m }))}
                      />
                    </Row>
                    <Row title={t("settings.temperature")} sub={t("settings.temperatureSub")}>
                      <div className="set-range">
                        <input type="range" min="0" max="1" step="0.1" disabled={!isAdmin}
                          value={cfg.LLM_TEMPERATURE}
                          onChange={(e) => setCfg({ ...cfg, LLM_TEMPERATURE: parseFloat(e.target.value) })} />
                        <span className="set-range-val">{Number(cfg.LLM_TEMPERATURE).toFixed(1)}</span>
                      </div>
                    </Row>
                    <Row title={t("settings.topK")} sub={t("settings.topKSub")}>
                      <div className="set-range">
                        <input type="range" min="1" max="10" step="1" disabled={!isAdmin}
                          value={cfg.RETRIEVAL_TOP_K}
                          onChange={(e) => setCfg({ ...cfg, RETRIEVAL_TOP_K: parseInt(e.target.value, 10) })} />
                        <span className="set-range-val">{cfg.RETRIEVAL_TOP_K}</span>
                      </div>
                    </Row>
                    <Row title={t("settings.chunkSize")} sub={t("settings.chunkSizeSub")}>
                      <input className="set-input set-input-sm" type="number" min="200" max="4000" step="50"
                        disabled={!isAdmin} value={cfg.CHUNK_SIZE}
                        onChange={(e) => setCfg({ ...cfg, CHUNK_SIZE: parseInt(e.target.value, 10) || 0 })} />
                    </Row>
                    <Row title={t("settings.chunkOverlap")} sub={t("settings.chunkOverlapSub")}>
                      <input className="set-input set-input-sm" type="number" min="0" max="1000" step="10"
                        disabled={!isAdmin} value={cfg.CHUNK_OVERLAP}
                        onChange={(e) => setCfg({ ...cfg, CHUNK_OVERLAP: parseInt(e.target.value, 10) || 0 })} />
                    </Row>
                    {isAdmin && (
                      <div className="set-actions">
                        <button className="btn btn-primary" onClick={saveConfig}>{t("settings.saveConfig")}</button>
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
          title={t("settings.clearAllTitle")}
          text={t("settings.clearAllText")}
          okLabel={t("settings.clearHistory")}
          onConfirm={() => { setConfirmClear(false); chat.clearAllConversations(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title={t("settings.deleteAccountTitle")}
          text={t("settings.deleteAccountText")}
          okLabel={t("settings.deleteAccount")}
          onConfirm={deleteAccount}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
