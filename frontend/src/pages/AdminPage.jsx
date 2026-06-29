import { useEffect, useState } from "react";
import client from "../api/client";

function StatCard({ label, value, accent = "text-white" }) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-3xl font-semibold tracking-tight mt-1.5 ${accent}`}>{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, u] = await Promise.all([client.get("/api/admin/stats"), client.get("/api/admin/users")]);
        setStats(s.data);
        setUsers(u.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load admin data");
      }
    })();
  }, []);

  if (error) return <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{error}</div>;
  if (!stats) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-white">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={stats.total_users} />
        <StatCard label="Active users" value={stats.active_users} accent="text-exercise" />
        <StatCard label="Documents" value={stats.total_documents} accent="text-stand" />
        <StatCard label="Queries" value={stats.total_queries} accent="text-move" />
        <StatCard label="Avg response (ms)" value={stats.avg_response_time_ms} />
      </div>

      <div className="bg-surface border border-hairline rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-3">Queries by provider</h2>
        {Object.keys(stats.queries_by_provider).length === 0 ? (
          <p className="text-sm text-muted/70">No queries yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted">
            {Object.entries(stats.queries_by_provider).map(([p, c]) => (
              <li key={p}>
                {p}: <span className="font-medium text-white">{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-surface border border-hairline rounded-2xl overflow-x-auto">
        <h2 className="font-semibold text-white px-5 pt-5 pb-3">Users</h2>
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-muted text-left border-b border-hairline">
            <tr>
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t border-hairline/60">
                <td className="px-5 py-3 text-white">{u.username}</td>
                <td className="px-5 py-3 text-muted">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={u.role === "admin" ? "text-move font-medium" : "text-muted"}>{u.role}</span>
                </td>
                <td className="px-5 py-3 text-muted">{u.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
