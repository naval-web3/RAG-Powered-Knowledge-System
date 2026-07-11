import { useEffect, useState } from "react";
import client from "../api/client";
import Icon from "../components/Icon";
import { AreaChart, BarChart, DonutChart } from "../components/Charts";
import { useToast } from "../context/ToastContext";
import { initialsOf, timeAgo } from "../utils";

export default function AdminPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [system, setSystem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, u, l, sys] = await Promise.all([
          client.get("/api/admin/stats"),
          client.get("/api/admin/users"),
          client.get("/api/admin/query-logs?limit=25"),
          client.get("/api/admin/system"),
        ]);
        setStats(s.data);
        setUsers(u.data);
        setLogs(l.data);
        setSystem(sys.data);
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load dashboard data.");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="page"><div className="page-pad">
        <div className="badge badge-red" style={{ padding: "10px 14px", borderRadius: 12 }}>
          <Icon name="alert" className="icon-sm" /> {error}
        </div>
      </div></div>
    );
  }
  if (!stats) {
    return <div className="page"><div className="page-pad"><p className="page-sub">Loading dashboard…</p></div></div>;
  }

  const days = stats.queries_by_day || [];
  const queryValues = days.map((d) => d.count);
  const total14 = queryValues.reduce((a, b) => a + b, 0);
  const openai = stats.queries_by_provider?.openai || 0;
  const ollama = stats.queries_by_provider?.ollama || 0;
  const typeColors = { pdf: "var(--red)", docx: "var(--blue)", txt: "var(--text-3)" };
  const typeItems = Object.entries(stats.documents_by_type || {}).map(([k, v]) => ({
    k, v, c: typeColors[k] || "var(--accent)",
  }));

  return (
    <div className="page">
      <div className="page-pad">
        <h2 className="page-title">Admin dashboard</h2>
        <p className="page-sub">System analytics, query logs and user management. Visible to admin accounts only.</p>

        <div className="kpi-grid">
          <Kpi icon="file" label="Total documents" value={stats.total_documents} sub="in the corpus" />
          <Kpi icon="chat" label="Queries processed" value={stats.total_queries} sub="all time" />
          <Kpi icon="users" label="Active users" value={stats.active_users} sub={`of ${stats.total_users} total`} />
          <Kpi icon="zap" label="Avg response" value={`${(stats.avg_response_time_ms / 1000).toFixed(1)} s`} sub="per query" />
        </div>

        <div className="dash-grid">
          <div className="panel">
            <div className="panel-head"><h3>Queries · last 14 days</h3><span className="p-sub">{total14} total</span></div>
            <div className="chart-box"><AreaChart values={queryValues} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Provider usage</h3><span className="p-sub">by query</span></div>
            <div className="chart-box"><DonutChart a={openai} b={ollama} centerLabel="OPENAI" /></div>
            <div className="legend">
              <div className="lg-row"><span className="swatch" style={{ background: "var(--accent)" }} />OpenAI · cloud<span className="lg-val">{openai}</span></div>
              <div className="lg-row"><span className="swatch" style={{ background: "var(--blue)" }} />Ollama · local<span className="lg-val">{ollama}</span></div>
            </div>
          </div>
        </div>

        <div className="dash-grid" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
          <div className="panel">
            <div className="panel-head"><h3>Corpus by type</h3><span className="p-sub">indexed docs</span></div>
            <div className="chart-box">
              {typeItems.length ? <BarChart items={typeItems} /> : <p className="page-sub">No documents yet.</p>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>System status</h3><span className="p-sub">live health check</span></div>
            <div className="status-list">
              {(system?.services || []).map((svc) => (
                <div key={svc.name} className="st-row">
                  <span className="st-dot" style={{ background: svc.ok ? "var(--green)" : "var(--red)" }} />
                  <span className="st-name">{svc.name}</span>
                  <span className="st-detail">{svc.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head"><h3>Recent query logs</h3><span className="p-sub">{logs.length} recent</span></div>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Query</th><th>User</th><th>Provider · model</th><th>Chunks</th><th>Latency</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.log_id}>
                    <td className="q-cell" title={l.query_text}>{l.query_text}</td>
                    <td>{l.username || "—"}</td>
                    <td className="mono-cell">{l.llm_provider} · {l.model_name}</td>
                    <td className="mono-cell">{l.chunks_retrieved}</td>
                    <td className="mono-cell">{(l.response_time_ms / 1000).toFixed(1)} s</td>
                    <td><span className={`badge ${l.status === "success" ? "badge-green" : "badge-amber"}`}>{l.status}</span></td>
                    <td className="mono-cell">{timeAgo(l.created_at)}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={7} className="page-sub" style={{ padding: 20 }}>No queries logged yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Users</h3><span className="p-sub">role-based access control</span></div>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>User</th><th>Role</th><th>Documents</th><th>Queries</th><th>Last login</th><th>Active</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td>
                      <div className="doc-name">
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initialsOf(u.username)}</span>
                        <span>
                          <span className="d-title" style={{ display: "block" }}>{u.username}</span>
                          <span className="d-file">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td><span className={`badge role-pill ${u.role === "admin" ? "badge-accent" : "badge-gray"}`}>{u.role}</span></td>
                    <td className="mono-cell">{u.document_count}</td>
                    <td className="mono-cell">{u.query_count}</td>
                    <td className="mono-cell">{u.last_login ? timeAgo(u.last_login) : "never"}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={u.is_active} readOnly
                          onClick={(e) => { e.preventDefault(); toast("User activation is view-only in this build.", "info"); }} />
                        <span className="track" />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }) {
  return (
    <div className="kpi">
      <div className="k-label"><Icon name={icon} className="icon-sm" /> {label}</div>
      <div className="k-value">{value}</div>
      <span className="k-delta up" style={{ color: "var(--text-3)" }}>{sub}</span>
    </div>
  );
}
