import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import ConfirmModal from "./ConfirmModal";
import Icon from "./Icon";
import Tooltip from "./Tooltip";

/**
 * A document, shown as what it is.
 *
 * A text file, a Word file or a Markdown file opens to its source: the exact
 * characters the pipeline read, numbered, in a monospaced face. That is the
 * honest view of a file whose content IS text, and the numbers make it possible
 * to talk about a particular line.
 *
 * A PDF opens to a card instead. Its extraction is a flattening of something
 * that was laid out, and showing a wall of run-together text as though it were
 * the document would misrepresent it. The file itself is one click away, in a
 * reader built for it.
 *
 * The Chunks tab, what retrieval actually searched, belongs to the text kinds.
 */
const PLAIN = ["txt", "md", "docx"];
export default function DocumentDialog({ doc, onClose }) {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isPlain = PLAIN.includes((doc.file_type || "").toLowerCase());
  const [view, setView] = useState("reading");
  const [pageCount, setPageCount] = useState(null);
  const [content, setContent] = useState(null);
  const [chunks, setChunks] = useState(null);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const id = doc.document_id;

  useEffect(() => {
    let alive = true;
    setError(false);
    // A PDF is never read here: its own reader does that, and extracting it
    // again could mean re-running OCR to fill a panel nobody asked for.
    if (!isPlain) {
      client
        .get(`/api/documents/${id}/pages`)
        .then(({ data }) => alive && setPageCount(data.page_count || null))
        .catch(() => {});
      return () => { alive = false; };
    }
    client
      .get(`/api/documents/${id}/content`)
      .then(({ data }) => alive && setContent(data))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [id, isPlain]);

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
  const lines = fullText ? fullText.split("\n") : [];

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
      <div className={`modal doc-modal ${isPlain ? "" : "is-file"}`}
        role="dialog" aria-modal="true" aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}>

        <div className="doc-head">
          <h3 title={doc.title}>{doc.title}</h3>
          <Tooltip label={t("common.close")} placement="left">
            <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
              <Icon name="x" className="icon-sm" />
            </button>
          </Tooltip>
        </div>

        <div className="doc-bar">
          {isPlain && (
            <div className="set-seg doc-seg">
              <Tooltip label={t("docs.readingView")}>
                <button className={view === "reading" ? "active" : ""}
                  aria-label={t("docs.readingView")}
                  onClick={() => setView("reading")}>
                  <Icon name="eye" className="icon-sm" />
                </button>
              </Tooltip>
              <Tooltip label={t("docs.chunksView")}>
                <button className={view === "chunks" ? "active" : ""}
                  aria-label={t("docs.chunksView")}
                  onClick={() => setView("chunks")}>
                  <Icon name="db" className="icon-sm" />
                </button>
              </Tooltip>
            </div>
          )}
          <div className="grow" />
          <button className="btn doc-act" onClick={scopeToDoc}>
            <Icon name="target" className="icon-sm" /> {t("docs.scopeChat")}
          </button>
          {isPlain && (
            <Tooltip label={t("docs.copyText")}>
              <button className="btn-icon" aria-label={t("docs.copyText")}
                disabled={!fullText} onClick={copyText}>
                <Icon name="copy" className="icon-sm" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={t("docs.download")}>
            <button className="btn-icon" aria-label={t("docs.download")} onClick={download}>
              <Icon name="upload" className="icon-sm doc-dl" />
            </button>
          </Tooltip>
          {/* Last in the toolbar, against the dialog's right edge. */}
          <Tooltip label={t("common.delete")} placement="left">
            <button className="btn-icon doc-del" aria-label={t("common.delete")}
              onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" className="icon-sm" />
            </button>
          </Tooltip>
        </div>

        <div className="doc-body">
          {error && <p className="doc-note">{t("docs.loadFailed")}</p>}

          {/* A PDF: the file, not a flattening of it. */}
          {!isPlain && (
            <div className="doc-file">
              <span className="doc-stack" aria-hidden="true">
                <span className="doc-sheet" />
              </span>
              {pageCount ? (
                <p className="doc-file-meta">
                  {pageCount === 1 ? t("docs.onePage") : t("docs.pageCount", { n: pageCount })}
                </p>
              ) : null}
              <button className="btn doc-file-dl" onClick={download}>
                <Icon name="upload" className="icon-sm doc-dl" /> {t("docs.download")}
              </button>
            </div>
          )}

          {isPlain && !error && view === "reading" && (
            !content ? (
              <p className="doc-note">{t("docs.loading")}</p>
            ) : (
              <>
                {/* Numbered down the side, so a line can be pointed at. The
                    number column does not select with the text: it is a
                    counter, not part of the file. */}
                <div className="doc-source">
                  {lines.map((line, i) => (
                    <div className="doc-line" key={i}>
                      <span className="doc-ln">{i + 1}</span>
                      <span className="doc-code">{line || "\u00a0"}</span>
                    </div>
                  ))}
                </div>
                {content.truncated && <p className="doc-note">{t("docs.truncated")}</p>}
              </>
            )
          )}

          {isPlain && !error && view === "chunks" && (
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
