import { useCallback, useEffect, useRef, useState } from "react";

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
 * Returns [ref, className]. Put both on the element that scrolls:
 *
 *   const [ref, fade] = useEdgeFade();
 *   <div ref={ref} className={`my-list ${fade}`}>
 *
 * `ref` is a CALLBACK ref, not a ref object, and that is the point. Most of
 * these scrollers are rendered conditionally -- a dropdown's list exists only
 * while it is open -- and a ref object gives an effect nothing to depend on, so
 * an effect that ran at mount found null and never looked again. A callback ref
 * sets state, which is something the effect can wait for. To share the node
 * with a ref of your own, call it: ref={(el) => { mine.current = el; fade(el); }}
 */
export default function useEdgeFade() {
  const [node, setNode] = useState(null);
  const [fade, setFade] = useState({ top: false, bot: false });
  const measureRef = useRef(null);

  const ref = useCallback((el) => setNode(el), []);

  useEffect(() => {
    if (!node) {
      setFade((prev) => (prev.top || prev.bot ? { top: false, bot: false } : prev));
      return undefined;
    }
    const measure = () => {
      const top = node.scrollTop > 2;
      const bot = node.scrollTop + node.clientHeight < node.scrollHeight - 2;
      setFade((prev) => (prev.top === top && prev.bot === bot ? prev : { top, bot }));
    };
    measureRef.current = measure;
    measure();

    node.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    // The content's own height changes without the box changing at all.
    if (node.firstElementChild) ro?.observe(node.firstElementChild);
    return () => {
      node.removeEventListener("scroll", measure);
      ro?.disconnect();
      measureRef.current = null;
    };
  }, [node]);

  // Cheap, and no dependency array on purpose: a list gains and loses its
  // overflow as items arrive, as a filter narrows it and as a group collapses,
  // none of which fire a scroll event or resize anything.
  useEffect(() => {
    measureRef.current?.();
  });

  return [ref, `edge-fade ${fade.top ? "fade-top" : ""} ${fade.bot ? "fade-bot" : ""}`.trim()];
}
