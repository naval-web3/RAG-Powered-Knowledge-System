import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import ConfirmModal from "./ConfirmModal";
import Icon from "./Icon";

/**
 * One document, two ways.
 *
 * Reading shows the extraction: the text the pipeline actually pulled out,
 * page by page, which for a scanned PDF is its OCR rather than a blank page.
 * Chunks shows what that text was split into and indexed as, which is what
 * retrieval searches. Between them they answer "what is in this file" and
 * "why did it match that", and the second question has no other answer in
 * the app.
 */
export default function DocumentDialog({ doc, onClose }) {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState("reading");
  const [content, setContent] = useState(null);
  const [chunks, setChunks] = useState(null);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const id = doc.document_id;

  useEffect(() => {
    let alive = true;
    setError(false);
    client
      .get(`/api/documents/${id}/content`)
      .then(({ data }) => alive && setContent(data))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [id]);

  // Fetched only if the chunks tab is opened: it is the larger of the two, and
  // most visits only ever want to read the document.
  useEffect(() => {
    if (view !== "chunks" || chunks) return undefined;
    let alive = true;
    client
      .get(`/api/documents/${id}/chunks`)
      .then(({ data }) => alive && setChunks(data))
      .catch(() => alive && setChunks([]));
    return () => { alive = false; };
  }, [view, chunks, id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fullText = content
    ? content.pages.map((p) => p.text).join("\n\n")
    : "";

  function copyText() {
    navigator.clipboard?.writeText(fullText).then(
      () => toast(t("docs.copied"), "ok"),
      () => toast(t("docs.copyFailed"), "err")
    );
  }

  /* The scope control already exists on the composer; this is the natural place
     to reach it, so it sets the scope and gets out of the way. */
  function scopeToDoc() {
    chat.setScopeDocId(id);
    onClose();
    navigate("/");
    toast(t("docs.scoped", { title: doc.title }), "ok");
  }

  async function download() {
    try {
      const res = await client.get(`/api/documents/${id}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename || doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast(t("docs.loadFailed"), "err");
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await client.delete(`/api/documents/${id}`);
      chat.loadDocs();
      toast(t("docs.deleted"), "ok");
      onClose();
    } catch {
      toast(t("docs.deleteFailed"), "err");
    }
  }

  return (
    <div className="modal-overlay doc-overlay" onClick={onClose}>
      <div className="modal doc-modal" role="dialog" aria-modal="true" aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}>

        <div className="doc-head">
          <h3 title={doc.title}>{doc.title}</h3>
          <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>

        <div className="doc-bar">
          <div className="set-seg doc-seg">
            <button className={view === "reading" ? "active" : ""}
              title={t("docs.readingView")} aria-label={t("docs.readingView")}
              onClick={() => setView("reading")}>
              <Icon name="eye" className="icon-sm" />
            </button>
            <button className={view === "chunks" ? "active" : ""}
              title={t("docs.chunksView")} aria-label={t("docs.chunksView")}
              onClick={() => setView("chunks")}>
              <Icon name="db" className="icon-sm" />
            </button>
          </div>
          <div className="grow" />
          <button className="btn doc-act" onClick={scopeToDoc}>
            <Icon name="target" className="icon-sm" /> {t("docs.scopeChat")}
          </button>
          <button className="btn-icon" title={t("docs.copyText")} aria-label={t("docs.copyText")}
            disabled={!fullText} onClick={copyText}>
            <Icon name="copy" className="icon-sm" />
          </button>
          <button className="btn-icon" title={t("docs.download")} aria-label={t("docs.download")}
            onClick={download}>
            <Icon name="upload" className="icon-sm doc-dl" />
          </button>
          <button className="btn-icon doc-del" title={t("common.delete")} aria-label={t("common.delete")}
            onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" className="icon-sm" />
          </button>
        </div>

        <div className="doc-body">
          {error && <p className="doc-note">{t("docs.loadFailed")}</p>}

          {!error && view === "reading" && (
            !content ? (
              <p className="doc-note">{t("docs.loading")}</p>
            ) : (
              <>
                {content.pages.map((p) => (
                  <section key={p.page_number} className="doc-page">
                    {content.pages.length > 1 && (
                      <div className="doc-page-no">{t("docs.page", { n: p.page_number })}</div>
                    )}
                    <p className="doc-text">{p.text}</p>
                  </section>
                ))}
                {content.truncated && <p className="doc-note">{t("docs.truncated")}</p>}
              </>
            )
          )}

          {!error && view === "chunks" && (
            !chunks ? (
              <p className="doc-note">{t("docs.loading")}</p>
            ) : chunks.length === 0 ? (
              <p className="doc-note">{t("docs.noChunks")}</p>
            ) : (
              <>
                <p className="doc-note">{t("docs.chunksNote")}</p>
                {chunks.map((c, i) => (
                  <article key={i} className="doc-chunk">
                    <header>
                      <span className="doc-chunk-no">{t("docs.chunkLabel", { n: i + 1 })}</span>
                      {c.page_number != null && (
                        <span className="doc-chunk-meta">
                          {t("docs.chunkMeta", { page: c.page_number })}
                        </span>
                      )}
                      {c.section && <span className="doc-chunk-sec">{c.section}</span>}
                    </header>
                    <p>{c.text}</p>
                  </article>
                ))}
              </>
            )
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={t("docs.deleteTitle")}
          text={t("docs.deleteText")}
          okLabel={t("common.delete")}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
