import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { IconPlus, IconTrash } from "../components/icons";

const STATUS_STYLES = {
  pending: "bg-yellow-400/15 text-yellow-300",
  processing: "bg-stand/15 text-stand",
  done: "bg-exercise/15 text-exercise",
  failed: "bg-danger/15 text-danger",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    loadDocs();
  }, []);

  useEffect(() => {
    const anyPending = docs.some((d) => ["pending", "processing"].includes(d.processing_status));
    if (!anyPending) return;
    const t = setInterval(loadDocs, 2500);
    return () => clearInterval(t);
  }, [docs]);

  async function loadDocs() {
    const { data } = await client.get("/api/documents");
    setDocs(data);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await client.post("/api/documents", form, { headers: { "Content-Type": "multipart/form-data" } });
      await loadDocs();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id) {
    if (!confirm("Delete this document and its indexed chunks?")) return;
    await client.delete(`/api/documents/${id}`);
    loadDocs();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Document Library</h1>
          <p className="text-sm text-muted mt-0.5">Everything you've uploaded and indexed.</p>
        </div>
        <label className="flex items-center gap-2 bg-move-gradient text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-95 transition ring-glow">
          <IconPlus className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload"}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && <div className="mb-4 text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-hairline">
            <tr>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Chunks</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted/70">
                  No documents yet. Upload one to get started.
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.document_id} className="border-t border-hairline/60">
                <td className="px-5 py-3.5 text-white">{d.title}</td>
                <td className="px-5 py-3.5 uppercase text-muted">{d.file_type}</td>
                <td className="px-5 py-3.5 text-muted">{d.chunk_count}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[d.processing_status] || ""}`}>
                    {d.processing_status}
                  </span>
                  {d.processing_status === "failed" && d.error_message && (
                    <span className="block text-xs text-danger/80 mt-1">{d.error_message}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => remove(d.document_id)} className="text-muted hover:text-danger transition inline-flex" title="Delete">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
