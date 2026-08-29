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

// Fine-grained stage -> index of the pipeline step currently being worked on.
// Steps before it are genuinely finished; steps after it have not started.
const STAGE_STEP = { extracting: 1, ocr: 1, chunking: 2, embedding: 2, indexing: 3, done: 4 };

// Human labels for the raw stage tokens the backend stores.
const STAGE_LABEL = {
  extracting: "Extracting text",
  ocr: "Reading scan (OCR)",
  chunking: "Chunking",
  embedding: "Embedding",
  indexing: "Indexing",
  done: "Indexed",
  failed: "Failed",
};

/**
 * Ease the displayed percentage toward the real one reported by the backend.
 * Progress only arrives on each poll, so without this the bar sits frozen in
 * between; while work is still running we also let it creep a bounded amount
 * past the last known value so it never looks stalled. It never moves
 * backwards, and a finished document always lands exactly on 100.
 */
function useSmoothProgress(target, running) {
  const [shown, setShown] = useState(target);
  const v = useRef(target);
  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 120) / 1000;
      last = now;
      // Never claim more than 99% until the backend actually says done.
      const ceil = running ? Math.min(target + 6, 99) : Math.max(target, v.current);
      if (v.current < ceil - 0.05) {
        const gap = ceil - v.current;
        // Catch up fast on a fresh poll, then creep slowly once caught up.
        v.current = Math.min(ceil, v.current + Math.max(gap * 3, 2) * dt);
        setShown(v.current);
      } else if (!running) {
        return; // settled on a final value - stop the loop instead of idling
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, running]);
  return shown;
}

// Slim progress bar shown inside a library row while the document is ingesting.
function RowProgress({ doc }) {
  const running = ["processing", "ocr"].includes(doc.processing_status);
  const pct = useSmoothProgress(doc.progress || 0, running);
  return (
    <div className="row-prog" title={doc.stage_detail || ""}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DocumentsPage() {
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dragover, setDragover] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const docs = chat.docs;

  // Poll while anything is still in the pipeline.
  useEffect(() => {
    if (!docs.some((d) => IN_PIPELINE.includes(d.processing_status))) return;
    const t = setInterval(() => chat.loadDocs(), 1500);
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

  // Resolve the open document from the live list on every render, so the detail
  // modal tracks the polling updates instead of showing a stale snapshot taken
  // when it was opened. Also closes itself if the document is deleted.
  const detailDoc = useMemo(
    () => docs.find((d) => d.document_id === detailId) || null,
    [docs, detailId]
  );

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
    toast(`Chat scoped to “${d.title}”`, "info");
    navigate("/");
  }

  async function confirmDelete() {
    const d = toDelete;
    setToDelete(null);
    try {
      await client.delete(`/api/documents/${d.document_id}`);
      if (chat.scopeDocId === d.document_id) chat.setScopeDocId(null);
      chat.loadDocs();
      toast("Document deleted", "ok");
    } catch (err) {
      toast("Delete failed", "err", err?.response?.data?.detail);
    }
  }

  return (
    <div className="page">
      <div className="page-pad">
        <h2 className="page-title">Document library</h2>
        <p className="page-sub">Upload files here and watch them move through the pipeline.</p>

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
          {chat.uploadProgress ? (
            <>
              <h3>Uploading “{chat.uploadProgress.name}”</h3>
              <div className="prog" onClick={(e) => e.stopPropagation()}>
                <div className="prog-track"><span style={{ width: `${chat.uploadProgress.pct}%` }} /></div>
                <div className="prog-meta"><span>Sending file</span><span>{chat.uploadProgress.pct}%</span></div>
              </div>
            </>
          ) : (
            <>
              <h3>Drop files here or <b>browse</b></h3>
              <p>PDF, DOCX or TXT · up to 25 MB each · chunked automatically</p>
            </>
          )}
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
                        {IN_PIPELINE.includes(d.processing_status) && <RowProgress doc={d} />}
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
                          <button className="btn-icon" title="Details" onClick={() => setDetailId(d.document_id)}>
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

      {detailDoc && <DocDetail doc={detailDoc} onClose={() => setDetailId(null)} />}
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
  const queued = doc.processing_status === "pending";
  const running = !done && !failed && !queued;
  const pct = useSmoothProgress(doc.progress || 0, running);

  // Which step is in flight right now. Documents uploaded before live progress
  // existed have no stage, so fall back to the coarse status for those.
  let active = STAGE_STEP[doc.stage];
  if (active === undefined) active = done ? 4 : 1;

  const detail = doc.stage_detail || "";
  const steps = [
    { key: "upload", title: "Uploaded", sub: doc.original_filename },
    {
      key: "extract",
      title: "Text extracted",
      sub:
        active === 1
          ? detail || (queued ? "queued" : "working\u2026")
          : `${doc.file_type.toUpperCase()} \u00b7 ${fmtBytes(doc.file_size)}`,
    },
    {
      key: "chunk",
      title: "Chunked & embedded",
      sub: active === 2 ? detail : active > 2 ? `${doc.chunk_count} chunks` : "pending",
    },
    {
      key: "index",
      title: "Indexed in vector store",
      sub: active === 3 ? detail : active > 3 ? "ready for retrieval" : "pending",
    },
  ];

  // A step is only ticked once it is genuinely behind us. The step in flight
  // pulses, and steps that have not started stay empty.
  function stepState(i) {
    if (i < active) return "done";
    if (i > active) return "";
    if (failed) return "fail";
    return queued ? "" : "now";
  }

  const statusLabel =
    STAGE_LABEL[doc.stage] || (STATUS[doc.processing_status] || STATUS.pending).label;

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
            <div className="mg"><b>Status</b><span>{statusLabel}</span></div>
            <div className="mg"><b>Uploaded</b><span>{timeAgo(doc.upload_date)}</span></div>
          </div>
          {(running || queued) && (
            <div className="prog">
              <div className="prog-track"><span style={{ width: `${pct}%` }} /></div>
              <div className="prog-meta">
                <span>{queued ? "Queued\u2026" : statusLabel}</span>
                <span>{Math.round(pct)}%</span>
              </div>
            </div>
          )}
          <div className="pipe">
            {steps.map((s, i) => {
              const state = stepState(i);
              return (
                <div key={s.key} className={`pipe-step ${state}`}>
                  <div className="pipe-rail">
                    <span className="pipe-dot">
                      {state === "done" && <Icon name="check" />}
                      {state === "fail" && <Icon name="x" />}
                    </span>
                    {i < steps.length - 1 && <span className="pipe-line" />}
                  </div>
                  <div className="pipe-body">
                    <div className="pt">{s.title}</div>
                    <div className="ps">
                      {state === "fail" ? doc.error_message || "this step failed" : s.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
