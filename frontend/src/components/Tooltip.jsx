import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip — a small dark label shown on hover or keyboard focus.
 *
 * The native title attribute cannot be styled and waits about a second, so
 * this replaces it.
 *
 * It renders into <body> rather than beside the control it belongs to. A
 * tooltip that lives inside the sidebar is clipped by the sidebar, and worse,
 * a panel that scrolls counts anything reaching past its edge as content wide
 * enough to deserve a scrollbar. Out here nothing can crop it, and the only
 * edge left to respect is the window's, which the placement below clamps to.
 *
 * `placement` picks the side. It is a preference, not a guarantee: the label is
 * nudged back inside the window if that side would put it out of view, so a
 * wrong guess is now untidy rather than unreadable.
 */
const GAP = 8;   // between the control and its label
const EDGE = 8;  // smallest gap left between the label and the window

export default function Tooltip({ label, keys, placement = "bottom", className = "", children }) {
  const anchorRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      /* Measure the control, not the wrapper around it. They are the same box
         while the control is in normal flow, but a control that is absolutely
         positioned leaves its wrapper behind: the private bar's close button is
         pinned to the right of the bar while its wrapper stays where the flow
         put it, at the left. Measuring the wrapper pointed the label at an
         empty corner of the screen. */
      const wrap = anchorRef.current;
      const anchor = wrap?.firstElementChild || wrap;
      const tip = tipRef.current;
      if (!anchor || !tip) return;
      const r = anchor.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;

      let top;
      let left;
      if (placement === "top") {
        top = r.top - h - GAP;
        left = r.left + r.width / 2 - w / 2;
      } else if (placement === "left") {
        top = r.top + r.height / 2 - h / 2;
        left = r.left - w - GAP;
      } else if (placement === "right") {
        top = r.top + r.height / 2 - h / 2;
        left = r.right + GAP;
      } else {
        top = r.bottom + GAP;
        left = r.left + r.width / 2 - w / 2;
      }

      // Slide back inside the window rather than hang off it.
      left = Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - w - EDGE));
      top = Math.min(Math.max(EDGE, top), Math.max(EDGE, window.innerHeight - h - EDGE));

      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    };
    place();

    /* A wheel scroll does not move the pointer, so the control can slide out
       from under a label that stays put. Close instead of chasing it. */
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, placement, label]);

  /* Focus alone is not a request for a label. A click focuses what it hits and
     a closing menu hands focus back, and either can arrive while the pointer is
     somewhere else entirely -- at which point no mouseleave is ever coming and
     the label stays on screen until something else takes focus. :focus-visible
     is the browser's own answer to "did a keyboard do this", and a keyboard is
     the only focus that has no pointer to speak for it. */
  const onFocus = (e) => {
    const el = e.target;
    try {
      if (el instanceof Element && el.matches(":focus-visible")) setOpen(true);
    } catch {
      /* An engine without :focus-visible gets no label here rather than a
         stuck one. Hover still works, which is how it is reached anyway. */
    }
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={`tip-wrap ${className}`.trim()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        /* Pressing the control is not asking what it is. Without this the label
           sits over the thing you just clicked -- and over the composer's own
           placeholder, in the case of the add button. */
        onMouseDown={() => setOpen(false)}
        onFocus={onFocus}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            className={`tip tip-${placement} ${pos ? "placed" : ""}`}
            role="tooltip"
            /* Parked off-screen for the one frame before it has been measured,
               rather than hidden: it has to be laid out to have a width. */
            style={{ top: pos ? pos.top : 0, left: pos ? pos.left : -9999 }}
          >
            {label}
            {keys && <span className="tip-keys">{keys}</span>}
          </span>,
          document.body
        )}
    </>
  );
}
