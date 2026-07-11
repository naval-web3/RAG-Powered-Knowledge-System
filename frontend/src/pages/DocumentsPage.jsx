import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import Icon from "../components/Icon";
import client from "../api/client";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { fmtBytes, timeAgo } from "../utils";
import { useNavigate } from "react-router-dom";

const STATUS = {
  pending: { cls: "badge-gray", label: "Queued" },
  processing: { cls: "badge-amber pulsing", label: "Processing" },
  ocr: { cls: "badge-amber pulsing", label: "OCR" },
  done: { cls: "badge-green", label: "Indexed" },
  failed: { cls: "badge-red", label: "Failed" },
};

const FILTER_MATCH = {
  Indexed: ["done"],
  Processing: ["processing", "ocr"],
  Queued: ["pending"],
  Failed: ["failed"],
};

const IN_PIPELINE = ["pending", "processing", "ocr"];

export default function DocumentsPage() {
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dragover, setDragover] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const docs = chat.docs;

  // Poll while anything is still in the pipeline.
  useEffect(() => {
    if (!docs.some((d) => IN_PIPELINE.includes(d.processing_status))) return;
    const t = setInterval(() => chat.loadDocs(), 2500);
    return () => clearInterval(t);
  }, [docs, chat]);

  const stats = useMemo(() => {
    const chunks = docs.reduce((n, d) => n + (d.chunk_count || 0), 0);
    const bytes = docs.reduce((n, d) => n + (d.file_size || 0), 0);
    const inPipe = docs.filter((d) => IN_PIPELINE.includes(d.processing_status)).length;
    return { count: docs.length, chunks, inPipe, mb: (bytes / (1024 * 1024)).toFixed(1) };
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q) && !d.original_filename.toLowerCase().includes(q)) return false;
      if (typeFilter && d.file_type !== typeFilter) return false;
      if (statusFilter && !(FILTER_MATCH[statusFilter] || []).includes(d.processing_status)) return false;
      return true;
    });
  }, [docs, search, typeFilter, statusFilter]);

  async function handleFiles(list) {
    const files = Array.from(list || []);
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      await chat.uploadFile(f);
    }
  }
  function onDrop(e) {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  }

  function chatWithDoc(d) {
    chat.setScopeDocId(d.document_id);
    toast(`Chat scoped to “${d.title}”.`, "info");
    navigate("/");
  }

  async function confirmDelete() {
    const d = toDelete;
    setToDelete(null);
    try {
      await client.delete(`/api/documents/${d.document_id}`);
      if (chat.scopeDocId === d.document_id) chat.setScopeDocId(null);
      chat.loadDocs();
      toast("Document deleted.", "ok");
    } catch (err) {
      toast("Delete failed.", "err", err?.response?.data?.detail);
    }
  }

  return (
    <div className="page">
      <div className="page-pad">
        <h2 className="page-title">Document library</h2>
        <p className="page-sub">Upload sources, watch the processing pipeline, and manage your indexed corpus.</p>

        <div className="stat-row">
          <StatChip icon="file" label="Documents" value={stats.count} />
          <StatChip icon="db" label="Chunks indexed" value={stats.chunks} />
          <StatChip icon="clock" label="In pipeline" value={stats.inPipe} />
          <StatChip icon="server" label="Storage" value={<>{stats.mb}<small>MB</small></>} />
        </div>

        <div
          className={`dropzone ${dragover ? "dragover" : ""}`}
          role="button" tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={onDrop}
        >
          <div className="dz-icon"><Icon name="upload" /></div>
          <h3>Drop files here or <b>browse</b></h3>
          <p>PDF, DOCX or TXT · up to 25 MB each · chunked automatically</p>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" multiple hidden
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        </div>

        <div className="toolbar">
          <div className="tb-search">
            <Icon name="search" className="icon-sm" />
            <input type="text" placeholder="Search documents…" autoComplete="off"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" aria-label="Filter by type" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="txt">TXT</option>
          </select>
          <select className="select" aria-label="Filter by status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Indexed">Indexed</option>
            <option value="Processing">Processing</option>
            <option value="Queued">Queued</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Document</th><th>Type</th><th>Size</th><th>Chunks</th>
                  <th>Status</th><th>Uploaded</th><th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const st = STATUS[d.processing_status] || STATUS.pending;
                  return (
                    <tr key={d.document_id}>
                      <td>
                        <div className="doc-name">
                          <span className={`file-ic ${d.file_type}`}>{d.file_type}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="d-title">{d.title}</div>
                            <div className="d-file">{d.original_filename}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono-cell">{d.file_type.toUpperCase()}</td>
                      <td className="mono-cell">{fmtBytes(d.file_size)}</td>
                      <td className="mono-cell">{d.chunk_count || "—"}</td>
                      <td>
                        <span className={`badge ${st.cls}`}><span className="dot" />{st.label}</span>
                        {d.processing_status === "failed" && d.error_message && (
                          <div className="d-file" style={{ color: "var(--red)", marginTop: 4, maxWidth: 220, whiteSpace: "normal" }}>
                            {d.error_message}
                          </div>
                        )}
                      </td>
                      <td className="mono-cell">{timeAgo(d.upload_date)}</td>
                      <td>
                        <div className="row-actions">
                          {d.processing_status === "done" && (
                            <button className="btn-icon" title="Chat with this document" onClick={() => chatWithDoc(d)}>
                              <Icon name="target" className="icon-sm" />
                            </button>
                          )}
                          <button className="btn-icon" title="Details" onClick={() => setDetail(d)}>
                            <Icon name="info" className="icon-sm" />
                          </button>
                          <button className="btn-icon" title="Delete" onClick={() => setToDelete(d)}>
                            <Icon name="trash" className="icon-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="empty-block">
              <div className="e-icon"><Icon name="file-text" /></div>
              <h3>{docs.length === 0 ? "No documents yet" : "No documents match your filters"}</h3>
              <p>{docs.length === 0 ? "Upload a PDF, DOCX or TXT to build your knowledge base." : "Try clearing the search or filters."}</p>
            </div>
          )}
        </div>
      </div>

      {detail && <DocDetail doc={detail} onClose={() => setDetail(null)} />}
      {toDelete && (
        <ConfirmModal
          title="Delete document?"
          text={`“${toDelete.title}” and its indexed chunks will be permanently removed.`}
          okLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return (
    <div className="stat-chip">
      <div className="s-label"><Icon name={icon} className="icon-sm" /> {label}</div>
      <div className="s-value">{value}</div>
    </div>
  );
}

function DocDetail({ doc, onClose }) {
  const failed = doc.processing_status === "failed";
  const done = doc.processing_status === "done";
  // Pipeline stages; mark done/current/failed based on status.
  const order = ["pending", "processing", "ocr", "done"];
  const idx = order.indexOf(doc.processing_status);
  const steps = [
    { key: "upload", title: "Uploaded", sub: doc.original_filename },
    { key: "extract", title: "Text extracted", sub: `${doc.file_type.toUpperCase()} · ${fmtBytes(doc.file_size)}` },
    { key: "chunk", title: "Chunked & embedded", sub: done ? `${doc.chunk_count} chunks` : "in progress" },
    { key: "index", title: "Indexed in vector store", sub: done ? "ready for retrieval" : "pending" },
  ];
  function stepState(i) {
    if (failed) return i === 0 ? "done" : i === 1 ? "fail" : "";
    if (done) return "done";
    // in progress: first step done, current at min(idx,steps)
    if (i === 0) return "done";
    if (i === 1) return idx >= 1 ? "now" : "";
    return "";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{doc.title}</h3>
          <button className="btn-icon" aria-label="Close" onClick={onClose}><Icon name="x" className="icon-sm" /></button>
        </div>
        <div className="modal-body">
          <div className="meta-grid">
            <div className="mg"><b>File</b><span>{doc.original_filename}</span></div>
            <div className="mg"><b>Type</b><span>{doc.file_type.toUpperCase()}</span></div>
            <div className="mg"><b>Size</b><span>{fmtBytes(doc.file_size)}</span></div>
            <div className="mg"><b>Chunks</b><span>{doc.chunk_count}</span></div>
            <div className="mg"><b>Status</b><span>{doc.processing_status}</span></div>
            <div className="mg"><b>Uploaded</b><span>{timeAgo(doc.upload_date)}</span></div>
          </div>
          <div className="pipe">
            {steps.map((s, i) => (
              <div key={s.key} className={`pipe-step ${stepState(i)}`}>
                <div className="pipe-rail">
                  <span className="pipe-dot">
                    <Icon name={stepState(i) === "fail" ? "x" : "check"} />
                  </span>
                  {i < steps.length - 1 && <span className="pipe-line" />}
                </div>
                <div className="pipe-body">
                  <div className="pt">{s.title}</div>
                  <div className="ps">{i === 1 && failed ? doc.error_message || "extraction failed" : s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
