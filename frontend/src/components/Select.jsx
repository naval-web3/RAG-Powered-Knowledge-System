import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * A dropdown that looks like the rest of the app instead of like the operating
 * system.
 *
 * A native <select> paints its list itself: the blue highlight, the metrics and
 * the type are the platform's, not ours, and none of it follows the theme. This
 * renders the list, so it can.
 *
 * The list is portalled into <body> for the reason everything else here is: the
 * settings pane scrolls, and a scrolling parent clips what overflows it on both
 * axes. A menu drawn inside the pane would be cut off at its edge.
 *
 * The trigger carries no box at rest. A fill fades in under the pointer and
 * stays while the list is open, so the control is quiet until you go looking
 * for it.
 */
const GAP = 6;
const EDGE = 8;
const MAX_H = 320;

export default function Select({ value, options, onChange, ariaLabel, disabled = false }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState(0);

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const btn = btnRef.current;
      const menu = menuRef.current;
      if (!btn || !menu) return;
      const r = btn.getBoundingClientRect();
      const h = menu.offsetHeight;
      const below = window.innerHeight - r.bottom - EDGE;
      const above = r.top - EDGE;
      // Below unless it genuinely does not fit and there is more room above.
      const up = below < h && above > below;
      const top = up ? Math.max(EDGE, r.top - h - GAP) : r.bottom + GAP;
      // Right-aligned: these sit at the right of a settings row, so their right
      // edges should line up down the panel.
      const right = Math.max(EDGE, window.innerWidth - r.right);
      setPos((p) => (p && p.top === top && p.right === right ? p : { top, right }));
    };
    place();

    /* A scroll outside the list moves the trigger out from under it. A scroll
       inside the list is someone reading it. */
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", () => setOpen(false));
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Open on the current choice, and bring it into view if the list is long.
  useEffect(() => {
    if (!open) return;
    setActive(index);
    const el = menuRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [open, index]);

  function choose(v) {
    setOpen(false);
    btnRef.current?.focus();
    if (v !== value) onChange(v);
  }

  function onKeyDown(e) {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active]?.value); }
  }

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`sel-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="sel-value">{current?.label ?? ""}</span>
        <Icon name="chev-d" className="icon-sm sel-chev" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="sel-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: pos ? pos.top : 0,
              right: pos ? pos.right : -9999,
              maxHeight: MAX_H,
            }}
            onKeyDown={onKeyDown}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                data-i={i}
                data-active={i === active ? "true" : undefined}
                role="option"
                aria-selected={o.value === value}
                className={`sel-opt ${i === active ? "active" : ""} ${o.value === value ? "chosen" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
              >
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" className="icon-sm sel-check" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
