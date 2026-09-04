import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { MIME } from "../docMime";
import Icon from "./Icon";
import MarkdownLite from "./MarkdownLite";

/**
 * Everything a project can read, and what is actually in it.
 *
 * The Context panel on the card can only ever show a name and a size. This is
 * the drawer behind it: pick a file on the left, read it on the right, in the
 * form it is really in — a PDF in a PDF reader with its pages and its layout,
 * a text or Word file as the characters the pipeline extracted. Those are two
 * different kinds of thing and showing a PDF as run-together text would be a
 * claim about the document that is not true.
 */
const PLAIN = ["txt", "md", "docx"];

export default function ContextDialog({ docs, title = "Context", onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);

  const listed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter(
      (d) =>
        (d.original_filename || "").toLowerCase().includes(needle) ||
        d.title.toLowerCase().includes(needle)
    );
  }, [docs, q]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ctxd-modal" role="dialog" aria-modal="true"
        aria-labelledby="ctxd-title" onClick={(e) => e.stopPropagation()}>
        <div className="ctxd-head">
          <div className="ctxd-heading">
            <h3 id="ctxd-title">{title}</h3>
            <p className="ctxd-sub">
              {docs.length === 1 ? "1 item" : `${docs.length} items`}
            </p>
          </div>
          <button className="btn-icon" aria-label="Close" onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>

        <div className="ctxd-body">
          <div className="ctxd-rail">
            <label className="pick-search">
              <Icon name="search" className="icon-sm" />
              <input
                type="text"
                autoFocus
                placeholder="Search files"
                aria-label="Search files"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="ctxd-files">
              {listed.length === 0 && (
                <p className="ctxd-none">No file matches “{q.trim()}”.</p>
              )}
              {/* The filename, not the title: a rename is for finding a
                  document in the app, but this list is about what the file is. */}
              {listed.map((d) => (
                <button
                  key={d.document_id}
                  className={`ctxd-file ${sel?.document_id === d.document_id ? "on" : ""}`}
                  onClick={() => setSel(d)}
                >
                  {d.original_filename || d.title}
                </button>
              ))}
            </div>
          </div>

          <div className="ctxd-pane">
            {sel ? (
              <FileView key={sel.document_id} doc={sel} />
            ) : (
              <p className="ctxd-empty">Select a file to view its contents.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One file, rendered as whatever it actually is. */
function FileView({ doc }) {
  const type = (doc.file_type || "").toLowerCase();
  const isPlain = PLAIN.includes(type);
  const [url, setUrl] = useState(null);
  const [content, setContent] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    setError(false);
    setUrl(null);
    setContent(null);

    if (isPlain) {
      client
        .get(`/api/documents/${doc.document_id}/content`)
        .then(({ data }) => alive && setContent(data))
        .catch(() => alive && setError(true));
      return () => { alive = false; };
    }

    /* Fetched and wrapped in an object URL rather than pointed at directly:
       the endpoint wants the bearer token and an iframe cannot carry a header.
       What comes back is the original file, so the browser's own reader draws
       it — pages, layout, its own search — instead of anything of ours. */
    client
      .get(`/api/documents/${doc.document_id}/file`, { responseType: "blob" })
      .then((res) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(
          new Blob([res.data], { type: MIME[type] || "application/pdf" })
        );
        setUrl(objectUrl);
      })
      .catch(() => alive && setError(true));

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.document_id, isPlain]);

  if (error) {
    return <p className="ctxd-empty">That file could not be opened.</p>;
  }

  if (isPlain) {
    if (!content) return <p className="ctxd-empty">Loading…</p>;
    const text = content.pages.map((p) => p.text).join("\n\n");
    return (
      <div className="ctxd-read">
        {/* Markdown is rendered because that is what a .md IS; a .txt or a
            .docx extraction is shown as the characters that were read. */}
        {type === "md" ? <MarkdownLite text={text} /> : <pre className="ctxd-plain">{text}</pre>}
        {content.truncated && (
          <p className="ctxd-note">Only the beginning of this file is shown.</p>
        )}
      </div>
    );
  }

  if (!url) return <p className="ctxd-empty">Loading…</p>;
  return <iframe className="ctxd-frame" src={url} title={doc.original_filename || doc.title} />;
}
