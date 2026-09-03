import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Placeholder rows for a sidebar list that has not arrived yet.
 *
 * ChatContext fires four fetches on mount and every list starts empty, so the
 * sidebar used to render its EMPTY STATES while they were still in flight --
 * "No conversations yet. Start a new chat." in front of someone with forty of
 * them, and "Pin documents here" over a full library. A blank list is only
 * unhelpful; that is untrue, and it is the actual reason this exists.
 *
 * The rows keep their real icon so the sidebar holds its shape while it waits,
 * rather than turning into a column of anonymous stripes.
 */

/* Varied so the list does not look like a form, but FIXED per position: a width
   picked at random per render would make every row twitch on the way past. */
const WIDTHS = [72, 54, 83, 61, 90, 47, 68, 78, 58, 86, 64, 75];

export function SkeletonRows({ n, icon }) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => (
    /* Hidden from screen readers: it is a picture of a list, and reading out
       a dozen empty rows is worse than saying nothing while the real ones
       land. The section is marked aria-busy instead. */
    <div className="sk-row" key={i} style={{ "--r": i }} aria-hidden="true">
      <Icon name={icon} className="icon-sm" />
      <span className="sk-bar" style={{ width: `${WIDTHS[i % WIDTHS.length]}%` }} />
    </div>
  ));
}

/**
 * Whether to draw the skeleton at all.
 *
 * The skeleton is what a reload shows FIRST, before any fetch has answered --
 * so `delay` is 0 and the guarding is all done by `hold`. An earlier version
 * waited 150ms before drawing anything, on the theory that a fast load should
 * stay still; what that actually produced was 150ms of the sidebar's EMPTY
 * STATES, because "not loaded" and "loaded and empty" looked the same to it.
 * Holding for `hold` is what stops the blink instead: the skeleton is up from
 * the first frame and stays a beat, whether the data takes 14ms or two seconds.
 */
export function useSkeleton(loading, { delay = 0, hold = 300 } = {}) {
  /* With no delay it has to be on screen at the FIRST render, not a tick later:
     even setTimeout(0) lands after the first paint, and that frame of blank
     sidebar is the very gap this exists to fill. */
  const [show, setShow] = useState(() => loading && delay <= 0);
  const shownAt = useRef(0);
  if (show && !shownAt.current) shownAt.current = Date.now();

  useEffect(() => {
    if (loading) {
      if (show) return undefined;
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
      return () => clearTimeout(t);
    }
    if (!show) return undefined;
    const left = hold - (Date.now() - shownAt.current);
    if (left <= 0) {
      setShow(false);
      return undefined;
    }
    const t = setTimeout(() => setShow(false), left);
    return () => clearTimeout(t);
  }, [loading, show, delay, hold]);

  return show;
}

/* Drawn as many rows as you had last time, so the skeleton is the shape of YOUR
   sidebar and nothing jumps when the real rows replace it. Capped, because a
   long list should not become a longer skeleton, and floored at the shape of a
   sidebar nobody has filled in yet. */
export const SK_KEY = "retrieva-sidebar-counts";
export const SK_FALLBACK = { docs: 2, projects: 2, chats: 6 };
export const SK_CAP = { docs: 8, projects: 8, chats: 12 };

export function readSkeletonCounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(SK_KEY) || "null");
    if (!saved) return SK_FALLBACK;
    return {
      docs: Number.isFinite(saved.docs) ? saved.docs : SK_FALLBACK.docs,
      projects: Number.isFinite(saved.projects) ? saved.projects : SK_FALLBACK.projects,
      chats: Number.isFinite(saved.chats) ? saved.chats : SK_FALLBACK.chats,
    };
  } catch {
    /* A browser refusing storage is not a reason to show no skeleton. */
    return SK_FALLBACK;
  }
}

export function writeSkeletonCounts(counts) {
  try {
    localStorage.setItem(SK_KEY, JSON.stringify({
      docs: Math.min(counts.docs, SK_CAP.docs),
      projects: Math.min(counts.projects, SK_CAP.projects),
      chats: Math.min(counts.chats, SK_CAP.chats),
    }));
  } catch {
    /* ignore */
  }
}
