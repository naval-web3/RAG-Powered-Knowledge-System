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
// Below this a list is not worth opening in place; it would be a scrollbar with
// a row and a half beside it.
const MIN_H = 120;

export default function Select({ value, options, onChange, ariaLabel, prefix, disabled = false }) {
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

      /* Bounded by the dialog the control sits in, not just by the window. The
         list is portalled to <body> so nothing clips it, which also means
         nothing stops it hanging out of the panel it belongs to unless it is
         told where the panel ends. */
      const box = btn.closest(".modal")?.getBoundingClientRect();
      const ceiling = Math.max(EDGE, box ? box.top + EDGE : EDGE);
      const floor = Math.min(
        window.innerHeight - EDGE,
        box ? box.bottom - EDGE : window.innerHeight - EDGE
      );

      const roomBelow = floor - r.bottom - GAP;
      const roomAbove = r.top - GAP - ceiling;
      // scrollHeight is the content's height whatever max-height is set to, so
      // it says how much room the list would like before it is given any.
      const wanted = Math.min(MAX_H, menu.scrollHeight);
      const up = roomBelow < wanted && roomAbove > roomBelow;
      const room = Math.max(MIN_H, Math.min(MAX_H, up ? roomAbove : roomBelow));

      /* Trimmed down to a whole number of rows. A list is allowed to be shorter
         than the space it has, and ending on a complete row is worth more than
         the twenty spare pixels: a half-drawn row at the bottom reads as broken
         rather than as "there is more". Both numbers are measured rather than
         written down, so changing the padding or the type does not quietly
         leave this behind. */
      const row = menu.querySelector(".sel-opt")?.offsetHeight || 34;
      const padY = 2 * parseFloat(getComputedStyle(menu).paddingTop || 0);
      const rows = Math.max(1, Math.floor((room - padY) / row));
      const maxH = Math.min(room, rows * row + padY);

      // Right-aligned: these sit at the right of a settings row, so their right
      // edges should line up down the panel.
      const right = Math.max(EDGE, window.innerWidth - r.right);
      /* Opening upwards pins the BOTTOM edge instead of the top, so the list
         grows away from the control without anyone having to know its height. */
      const next = up
        ? { top: null, bottom: Math.max(EDGE, window.innerHeight - r.top + GAP), right, maxH }
        : { top: r.bottom + GAP, bottom: null, right, maxH };
      setPos((prev) =>
        prev &&
        prev.top === next.top &&
        prev.bottom === next.bottom &&
        prev.right === next.right &&
        prev.maxH === next.maxH
          ? prev
          : next
      );
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
        {/* A label that belongs to the control rather than sitting beside
            it: "Sort by" is the first half of the sentence the value ends. */}
        {prefix && <span className="sel-prefix">{prefix}</span>}
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
              top: pos && pos.top != null ? pos.top : undefined,
              bottom: pos && pos.bottom != null ? pos.bottom : undefined,
              // Parked off-screen for the one frame before it is measured: it
              // has to be laid out to have a height worth reading.
              right: pos ? pos.right : -9999,
              maxHeight: pos ? pos.maxH : MAX_H,
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
