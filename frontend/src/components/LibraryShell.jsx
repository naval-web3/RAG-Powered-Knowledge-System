import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Select from "./Select";
import Tooltip from "./Tooltip";
import { useT } from "../i18n";

/**
 * The frame the two library pages share: a title, a search, a sort control
 * and one primary action, above a grid of cards.
 *
 * Documents and projects draw their own cards -- they carry different facts --
 * but the chrome around them is the same, because they are two views of one
 * idea: everything that did not earn a place in the sidebar.
 */

/**
 * Search and sort over a list, with pinned items held at the top.
 *
 * The orders come from the caller rather than being fixed here, because the
 * two pages do not have the same dates to offer. A project is created and then
 * changed, so it can be sorted by either; a document has one date, the day it
 * arrived, and offering "last updated" beside "date added" would be two names
 * for one column.
 */
export function useLibrary(items, sorts) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(sorts[0].value);

  const shown = useMemo(() => {
    const chosen = sorts.find((s) => s.value === sort) || sorts[0];
    const needle = q.trim().toLowerCase();
    const out = needle
      ? items.filter((it) => chosen.nameOf(it).toLowerCase().includes(needle))
      : items.slice();
    out.sort(chosen.cmp);
    /* Pinned to the top, as a second pass rather than a compound comparator:
       sort is stable, so this lifts them without disturbing the order chosen
       above. What sits in the sidebar should be easy to find again on the page
       that owns it. */
    out.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    return out;
  }, [items, q, sort, sorts]);

  return { q, setQ, sort, setSort, shown, sorts };
}

/** Newest first, and alphabetical, as comparators the caller can hand over. */
export const byDateDesc = (get) => (a, b) => new Date(get(b)) - new Date(get(a));
export const byName = (get) => (a, b) => get(a).localeCompare(get(b));

/**
 * The controls in the corner of a card. They share `lib-act`, which is what
 * holds them quiet until the card is under the pointer -- a card carrying two
 * lit buttons at rest is mostly buttons.
 */
export function PinButton({ pinned, onToggle, label }) {
  return (
    <Tooltip label={label} placement="top">
      <button
        className={`lib-act lib-pin ${pinned ? "on" : ""}`}
        aria-label={label}
        aria-pressed={pinned}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        <Icon name="pin" className="icon-sm" />
      </button>
    </Tooltip>
  );
}

/** Anything else a card offers: same corner, same reveal. */
export function CardAction({ icon, label, onClick }) {
  return (
    <Tooltip label={label} placement="top">
      <button
        className="lib-act"
        aria-label={label}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Icon name={icon} className="icon-sm" />
      </button>
    </Tooltip>
  );
}

/**
 * A search that is an icon until it is needed.
 *
 * Most visits to these pages are not searches -- they are "show me what I
 * have" -- and a field sitting open the whole time is a piece of furniture
 * asking to be filled in. It stays open while there is something typed in it,
 * so a result list is never left standing with nothing to say why.
 */
function LibrarySearch({ q, setQ, placeholder }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setQ("");
    setOpen(false);
  }

  if (!open && !q) {
    return (
      <Tooltip label={t("common.search")} placement="top">
        <button className="lib-search-btn" aria-label={t("common.search")}
          onClick={() => setOpen(true)}>
          <Icon name="search" className="icon-sm" />
        </button>
      </Tooltip>
    );
  }

  return (
    <label className="lib-search">
      <Icon name="search" className="icon-sm" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || t("common.search")}
        aria-label={placeholder || t("common.search")}
        /* Escape gets you out of a search the way it gets you out of
           everything else here, without reaching for the cross. */
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
      />
      <button className="lib-search-x" aria-label={t("common.close")} onClick={close}>
        <Icon name="x" className="icon-sm" />
      </button>
    </label>
  );
}

export default function LibraryShell({
  title, action, q, setQ, sort, setSort, sorts, searchLabel, children,
}) {
  const t = useT();
  return (
    <div className="page lib-page">
      <div className="page-pad lib-pad">
        <div className="lib-head">
          <h2 className="page-title">{title}</h2>
          <div className="lib-tools">
            <LibrarySearch q={q} setQ={setQ} placeholder={searchLabel} />
            {/* "Sort by" lives inside the control rather than beside it: it is
                the first half of the sentence the value finishes. */}
            <div className="lib-sort">
              <Select
                value={sort}
                ariaLabel={t("common.sortBy")}
                onChange={setSort}
                prefix={t("common.sortBy")}
                options={sorts.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
            {action}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
