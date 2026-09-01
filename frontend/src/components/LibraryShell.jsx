import { useMemo, useState } from "react";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Select from "./Select";
import { useT } from "../i18n";

/**
 * The frame the two library pages share: a title, a search box, a sort control
 * and one primary action, above a grid of cards.
 *
 * Documents and projects draw their own cards -- they carry different facts --
 * but the chrome around them is the same, because they are two views of one
 * idea: everything that did not earn a place in the sidebar.
 */

/** Search and sort over a list, with pinned items held at the top. */
export function useLibrary(items, nameOf, dateOf) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = needle
      ? items.filter((it) => nameOf(it).toLowerCase().includes(needle))
      : items.slice();
    out.sort((a, b) =>
      sort === "name"
        ? nameOf(a).localeCompare(nameOf(b))
        : new Date(dateOf(b)) - new Date(dateOf(a))
    );
    /* Pinned to the top, as a second pass rather than a compound comparator:
       sort is stable, so this lifts them without disturbing the order chosen
       above. What sits in the sidebar should be easy to find again on the page
       that owns it. */
    out.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    return out;
  }, [items, q, sort, nameOf, dateOf]);

  return { q, setQ, sort, setSort, shown };
}

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

export default function LibraryShell({ title, action, q, setQ, sort, setSort, children }) {
  const t = useT();
  return (
    <div className="page lib-page">
      <div className="page-pad lib-pad">
        <div className="lib-head">
          <h2 className="page-title">{title}</h2>
          <div className="lib-tools">
            <label className="lib-search">
              <Icon name="search" className="icon-sm" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("common.search")}
                aria-label={t("common.search")}
              />
            </label>
            <div className="lib-sort">
              <span className="lib-sort-label">{t("common.sortBy")}</span>
              <Select
                value={sort}
                ariaLabel={t("common.sortBy")}
                onChange={setSort}
                options={[
                  { value: "recent", label: t("common.sortRecent") },
                  { value: "name", label: t("common.sortName") },
                ]}
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
