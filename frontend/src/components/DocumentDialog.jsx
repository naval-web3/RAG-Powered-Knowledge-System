import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";
import MarkdownLite from "./MarkdownLite";
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
 * Two ways to look at one: read it, or read its source. Reading renders the
 * headings, emphasis and lists that are in the file; code shows the characters
 * that make them, numbered.
 */
const PLAIN = ["txt", "md", "docx"];
/* Enough Markdown to read the shape of a file at a glance: what a line IS
   (heading, quote, rule, list marker, table pipe) and where emphasis is marked.
   Not a parser, and deliberately not one: it colours the notation, and the
   Reading tab is there for anyone who wants the meaning instead. */
const MD_LINE = /^(\s*)(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/;

function highlight(line) {
  if (!line) return "\u00a0";
  if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
    return <span className="tok-rule">{line}</span>;
  }
  const lead = line.match(MD_LINE);
  const marker = lead ? lead[0] : "";
  const rest = lead ? line.slice(marker.length) : line;
  const isHeading = marker.trimStart().startsWith("#");
  return (
    <>
      {marker && <span className="tok-mark">{marker}</span>}
      <span className={isHeading ? "tok-heading" : undefined}>
        {rest.split(/(\*\*[^*]+\*\*|`[^`]+`|\|)/g).filter(Boolean).map((part, i) => {
          if (part === "|") return <span key={i} className="tok-mark">{part}</span>;
          if (part.startsWith("**") || part.startsWith("`")) {
            return <span key={i} className="tok-em">{part}</span>;
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    </>
  );
}

export default function DocumentDialog({ doc, onClose }) {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isPlain = PLAIN.includes((doc.file_type || "").toLowerCase());
  const [view, setView] = useState("reading");
  const [pageCount, setPageCount] = useState(null);
  const [thumb, setThumb] = useState(null);
  // Set if the page could not be drawn, so the card can say so rather than
  // showing an empty rectangle for ever.
  const [thumbFailed, setThumbFailed] = useState(false);
  // Only a .md is worth colouring: the others are prose that happens to be
  // monospaced, and painting stray asterisks in a .txt would invent structure
  // the file does not have.
  const isMd = (doc.file_type || "").toLowerCase() === "md";
  const [content, setContent] = useState(null);
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
      /* Fetched rather than pointed at with a src: the endpoint wants the
         bearer token, and an <img> cannot carry a header. The object URL is
         released on the way out so the blob is not held for the session. */
      let objectUrl = null;
      client
        .get(`/api/documents/${id}/thumbnail`, { responseType: "blob" })
        .then((res) => {
          if (!alive) return;
          objectUrl = URL.createObjectURL(res.data);
          setThumb(objectUrl);
        })
        .catch(() => alive && setThumbFailed(true));
      return () => {
        alive = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    client
      .get(`/api/documents/${id}/content`)
      .then(({ data }) => alive && setContent(data))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [id, isPlain]);

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

  function download() {
    chat.downloadDocument(doc);
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
          {/* The card has no toolbar to put this on, and beside the name is
              where it reads anyway: ask about THIS document. */}
          {!isPlain && (
            <Tooltip label={t("docs.scopeChat")} placement="left">
              <button className="btn-icon" aria-label={t("docs.scopeChat")} onClick={scopeToDoc}>
                <Icon name="target" className="icon-sm" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={t("common.close")} placement="left">
            <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
              <Icon name="x" className="icon-sm" />
            </button>
          </Tooltip>
        </div>

        {isPlain && (
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
              <Tooltip label={t("docs.codeView")}>
                <button className={view === "code" ? "active" : ""}
                  aria-label={t("docs.codeView")}
                  onClick={() => setView("code")}>
                  <Icon name="code" className="icon-sm" />
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
        )}

        <div className="doc-body">
          {error && <p className="doc-note">{t("docs.loadFailed")}</p>}

          {/* A PDF: the file, not a flattening of it. */}
          {!isPlain && (
            <div className="doc-file">
              {/* The sheets ARE the button: hovering them offers the file,
                  which is the only thing this card is for. */}
              <button className="doc-stack" onClick={download} aria-label={t("docs.download")}>
                {/* The page, in normal flow: it is what gives this button its
                    height. A landscape deck comes out landscape and a portrait
                    report portrait, with nothing measured to make that happen. */}
                {thumb ? (
                  <img className="doc-page-img" src={thumb} alt=""
                    onError={() => setThumbFailed(true)} />
                ) : (
                  <span className="doc-page-blank">
                    {thumbFailed && <Icon name="file-text" className="icon-lg" />}
                  </span>
                )}
                <span className="doc-stack-dl">
                  <Icon name="upload" className="icon-sm doc-dl" /> {t("docs.download")}
                </span>
              </button>
              {pageCount ? (
                <p className="doc-file-meta">
                  {pageCount === 1 ? t("docs.onePage") : t("docs.pageCount", { n: pageCount })}
                </p>
              ) : null}
            </div>
          )}

          {isPlain && !error && !content && (
            <p className="doc-note">{t("docs.loading")}</p>
          )}

          {/* Read: the document as it is meant to be read. The same renderer
              the chat uses, so a heading looks the same wherever it appears. */}
          {isPlain && !error && content && view === "reading" && (
            <>
              <article className="doc-read">
                <MarkdownLite text={fullText} />
              </article>
              {content.truncated && <p className="doc-note">{t("docs.truncated")}</p>}
            </>
          )}

          {/* Code: the characters that make it, numbered down the side. A long
              line keeps one number, on its first row, because the number counts
              lines in the file and not rows on the screen. */}
          {isPlain && !error && content && view === "code" && (
            <>
              <div className="doc-source">
                {lines.map((line, i) => (
                  <div className="doc-line" key={i}>
                    <span className="doc-ln">{i + 1}</span>
                    <span className="doc-code">
                      {isMd ? highlight(line) : line || "\u00a0"}
                    </span>
                  </div>
                ))}
              </div>
              {content.truncated && <p className="doc-note">{t("docs.truncated")}</p>}
            </>
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
