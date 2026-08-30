import { useEffect, useRef, useState } from "react";

/**
 * Fades whichever edge of a scroller still has content behind it.
 *
 * A scrolling list ends wherever its box ends, which cuts a row in half and
 * leaves it looking like a rendering fault rather than like more list. Fading
 * that edge says the same thing a sliced row was trying to: there is more.
 *
 * Both stops stay at zero until something is actually hidden, so a list that
 * fits is never dimmed at its ends for nothing.
 *
 * Returns [ref, className]. Put the ref on the element that scrolls and the
 * class on the same element.
 *
 *   const [ref, fade] = useEdgeFade();
 *   <div ref={ref} className={`my-list ${fade}`}>
 *
 * The listener is attached once, but the measurement runs on every render:
 * a list gains and loses its overflow as items arrive, as a filter narrows it
 * and as a group collapses, none of which fire a scroll event.
 */
export default function useEdgeFade() {
  const ref = useRef(null);
  const measureRef = useRef(null);
  const [fade, setFade] = useState({ top: false, bot: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const top = el.scrollTop > 2;
      const bot = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setFade((prev) => (prev.top === top && prev.bot === bot ? prev : { top, bot }));
    };
    measureRef.current = measure;
    measure();

    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // The content's own height changes without the box changing at all.
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      measureRef.current = null;
    };
  }, []);

  // Cheap, and no dependency array on purpose: see above.
  useEffect(() => {
    measureRef.current?.();
  });

  return [ref, `edge-fade ${fade.top ? "fade-top" : ""} ${fade.bot ? "fade-bot" : ""}`.trim()];
}
