import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { IconArrowLeft, IconTrash } from "../components/icons";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      await client.delete("/api/auth/account");
      logout();
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete account");
      setDeleting(false);
    }
  }

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-3 border-b border-hairline/60 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition mb-4"
      >
        <IconArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-semibold tracking-tight text-white mb-5">Settings</h1>

      {/* Account info */}
      <div className="bg-surface border border-hairline rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-white mb-2">Account</h2>
        <div className="text-sm">
          <Row label="Username" value={user?.username} />
          <Row label="Email" value={user?.email} />
          <Row label="Role" value={user?.role} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-surface border border-danger/40 rounded-2xl p-5">
        <h2 className="font-semibold text-danger mb-1">Danger zone</h2>
        <p className="text-sm text-muted mb-4">
          Permanently delete your account and all associated data — documents, indexed
          content, and chat history. This action cannot be undone.
        </p>
        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger/15 text-danger font-medium hover:bg-danger/25 transition"
          >
            <IconTrash className="w-4 h-4" /> Delete account
          </button>
        ) : (
          <div className="rounded-xl border border-danger/40 p-4 bg-danger/5">
            <p className="text-sm text-white mb-3">
              Type <span className="font-semibold text-danger">DELETE</span> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full mb-3 px-3.5 py-2.5 bg-surface2 border border-hairline rounded-xl text-white placeholder:text-muted/60 focus:outline-none focus:border-danger/60"
            />
            {error && <div className="mb-3 text-sm text-danger">{error}</div>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger text-white font-medium hover:opacity-90 disabled:opacity-40 transition"
              >
                <IconTrash className="w-4 h-4" />
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setError("");
                }}
                className="px-4 py-2.5 rounded-xl bg-surface2 text-muted hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
