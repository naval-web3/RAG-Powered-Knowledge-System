import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { useT } from "../i18n";
import { fmtBytes, fileExt } from "../utils";

/**
 * Choosing several documents at once, and the bar that appears when you have.
 *
 * Two places need this and they do not mean the same thing by it. On the
 * library page a selection can only be deleted; inside a project it can be
 * removed from the project OR deleted, and those are different enough that the
 * bar takes its actions from the caller rather than guessing.
 *
 * Selection mode is entered by ticking anything and left by the ✕ or by
 * untinking the last one. While it is on, every card shows its box: hunting
 * for a hover target on each card in turn is not a way to select six things.
 */
export function useSelection(items, idOf) {
  const [picked, setPicked] = useState(() => new Set());

  const ids = items.map(idOf);
  /* The ids themselves, not the array holding them. A new array arrives on
     every render even when nothing has changed, and depending on it would
     re-run the prune on every render for no reason. */
  const key = ids.join("|");

  /* A document deleted, detached or filtered out of view must not stay counted.
     Otherwise "3 selected" outlives the third one and the trash acts on a
     document the reader can no longer see. */
  useEffect(() => {
    setPicked((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(key ? key.split("|") : []);
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [key]);

  const toggle = useCallback((id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setPicked(new Set()), []);
  const all = ids.length > 0 && ids.every((id) => picked.has(id));
  const some = picked.size > 0;
  const toggleAll = useCallback(
    () => setPicked(all ? new Set() : new Set(key ? key.split("|") : [])),
    [all, key]
  );

  return { picked, toggle, clear, toggleAll, all, some, count: picked.size };
}

/**
 * The bar that takes the place of the grid's top edge while choosing.
 *
 * It is always mounted and opens by growing its own row from nothing, so the
 * grid below is pushed down over the same fifth of a second the bar takes to
 * arrive. Mounting it on demand animated the bar and snapped everything under
 * it, which is the half that was actually being noticed.
 */
export function SelectionBar({ open, count, all, onToggleAll, onClear, children }) {
  const t = useT();
  /* The last real number, held for the length of the close. Reading `count`
     straight would flash "0 selected" all the way down. */
  const shown = useRef(count);
  if (count > 0) shown.current = count;

  return (
    <div className={`sel-slot ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="sel-clip">
    <div className="sel-bar">
      <label className="sel-all">
        <input
          type="checkbox"
          checked={all}
          aria-label={t("docs.selectAll")}
          /* Partly ticked is a property, not an attribute -- React cannot set
             it from JSX, so it goes on the node. */
          ref={(el) => { if (el) el.indeterminate = !all && count > 0; }}
          onChange={onToggleAll}
        />
      </label>
      <span className="sel-count">{t("docs.selected", { n: shown.current })}</span>
      <div className="sel-acts">{children}</div>
      <Tooltip label={t("common.close")} placement="top">
        <button className="btn-icon" aria-label={t("common.close")} onClick={onClear}>
          <Icon name="x" className="icon-sm" />
        </button>
      </Tooltip>
        </div>
      </div>
    </div>
  );
}

/**
 * One document as a card.
 *
 * A PDF shows its first page, because a wall of filenames all ending in .pdf
 * is not a way to find one. Everything else shows what it is instead: there is
 * no page to draw for a .txt, and a blank rectangle would say less than "TXT".
 */
export function DocCard({ doc, selecting, selected, onToggle, onOpen, onRemove, removeLabel, children }) {
  const t = useT();
  const isPdf = (doc.file_type || "").toLowerCase() === "pdf";
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    if (!isPdf) return undefined;
    let alive = true;
    let url = null;
    /* Fetched rather than pointed at with a src: the endpoint wants the bearer
       token and an <img> cannot carry a header. Released on the way out so a
       page of cards does not hold a page of blobs. */
    client
      .get(`/api/documents/${doc.document_id}/thumbnail`, { responseType: "blob" })
      .then((res) => {
        if (!alive) return;
        url = URL.createObjectURL(res.data);
        setThumb(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.document_id, isPdf]);

  return (
    <div className={`doc-card ${selected ? "on" : ""} ${selecting ? "picking" : ""}`}>
      {/* The card is a button so the whole face opens the document, with the
          controls layered over it rather than nested inside it. */}
      <button className="doc-card-face" onClick={() => onOpen?.(doc)}>
        <span className="doc-card-name">{doc.title}</span>
        <span className="doc-card-size">{fmtBytes(doc.file_size)}</span>
        {thumb ? (
          <span className="doc-thumb"><img src={thumb} alt="" /></span>
        ) : (
          <span className="doc-thumb is-blank" />
        )}
        {/* The sidebar has always marked a failed document; the library did
            not, so a document that indexed to nothing looked exactly like a
            good one and would answer exactly like an empty one. */}
        <span className="doc-card-tags">
          <span className={`doc-kind ${doc.file_type}`}>
            {fileExt(doc.file_type, doc.original_filename).toUpperCase()}
          </span>
          {doc.processing_status === "failed" && (
            <span className="doc-kind is-failed">{t("docs.failed")}</span>
          )}
        </span>
      </button>

      {onRemove && (
        <Tooltip label={removeLabel} placement="top">
          <button className="doc-x" aria-label={removeLabel}
            onClick={() => onRemove(doc)}>
            <Icon name="x" className="icon-sm" />
          </button>
        </Tooltip>
      )}

      <label className="doc-pick" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected}
          aria-label={doc.title} onChange={() => onToggle(doc.document_id)} />
      </label>

      {children}
    </div>
  );
}
