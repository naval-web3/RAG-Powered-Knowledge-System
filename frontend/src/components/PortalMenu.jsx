import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A popover rendered into <body> and positioned from its anchor's box.
 *
 * The row menu used to live inside .sb-scroll, which clips what overflows it
 * and fades its own last 22px -- so a menu opened on one of the bottom rows
 * came out cut in half and greyed. Out here nothing crops it, at the cost of
 * having to place it by hand.
 */
export default function PortalMenu({ anchorRef, align = "right", className = "", children }) {
  const boxRef = useRef(null);
  const [pos, setPos] = useState(null);

  /* No dependency array on purpose: children change identity on every render
     of the owner, and the anchor moves whenever anything scrolls or resizes.
     Re-measuring each time is cheap; what matters is that identical numbers
     do not schedule another render, or this would never settle. */
  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const box = boxRef.current;
      if (!anchor || !box) return;
      const r = anchor.getBoundingClientRect();
      const h = box.offsetHeight;
      const below = window.innerHeight - r.bottom;
      // Flip up only when there is genuinely more room up there, so a menu
      // near the bottom does not jump above a button with space to spare.
      const up = below < h + 12 && r.top > below;
      const next = {
        top: up ? Math.max(8, r.top - h - 4) : r.bottom + 4,
        left: align === "left" ? Math.max(8, r.left) : null,
        right: align === "left" ? null : Math.max(8, window.innerWidth - r.right),
      };
      setPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.right === next.right
          ? prev
          : next
      );
    };
    place();
    window.addEventListener("resize", place);
    // Capture phase: a scroll inside the sidebar carries the anchor with it
    // and never reaches window on its own.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  });

  return createPortal(
    <div
      ref={boxRef}
      className={`pop-menu is-portal ${className}`}
      style={{
        top: pos ? pos.top : 0,
        left: pos && pos.left != null ? pos.left : undefined,
        right: pos && pos.right != null ? pos.right : undefined,
        // Hidden for the first pass only: the height has to be measured before
        // it can be decided whether the menu hangs down or up.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
