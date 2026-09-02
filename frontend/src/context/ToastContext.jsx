import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";

const ToastContext = createContext(null);

const ICON = { ok: "check", err: "alert", warn: "alert", info: "info" };

/* Three is as deep as the deck reads. Past that the cards behind are a texture
   rather than a count, and the oldest has had its time on screen. */
const MAX_SHOWN = 3;
/* The gap between cards once the deck is fanned out. */
const FAN_GAP = 10;
/* Used only until a card has been measured, so the first frame is not stacked
   on a height of zero. */
const GUESS_H = 56;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  /* Cards are different heights, so how far a fanned card has to travel cannot
     be written in CSS -- it is the sum of the ones in front of it. Measured
     from the laid-out element, never from an assumption about the text. */
  const [heights, setHeights] = useState({});
  /* Hovering fans the deck open to be read, so the countdown has to stop while
     it is -- otherwise the card you leaned in to read is the one that leaves.
     Deadlines are kept rather than durations, because a paused toast has to
     resume with the time it had left, not with a fresh full life. */
  const [paused, setPaused] = useState(false);
  const timers = useRef(new Map());
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    const e = timers.current.get(id);
    if (e?.handle) clearTimeout(e.handle);
    timers.current.delete(id);
    setToasts((list) =>
      list.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      setHeights((m) => {
        if (!(id in m)) return m;
        const next = { ...m };
        delete next[id];
        return next;
      });
    }, 250);
  }, []);

  /* Start (or restart) a toast's countdown. */
  const arm = useCallback((id, ms) => {
    const e = timers.current.get(id);
    if (e?.handle) clearTimeout(e.handle);
    timers.current.set(id, {
      due: Date.now() + ms,
      handle: paused ? null : setTimeout(() => dismiss(id), ms),
      left: ms,
    });
  }, [dismiss, paused]);

  useEffect(() => {
    const m = timers.current;
    if (paused) {
      m.forEach((e) => {
        if (!e.handle) return;
        clearTimeout(e.handle);
        e.handle = null;
        e.left = Math.max(0, e.due - Date.now());
      });
    } else {
      m.forEach((e, id) => {
        if (e.handle) return;
        const ms = e.left ?? Math.max(0, e.due - Date.now());
        e.due = Date.now() + ms;
        e.handle = setTimeout(() => dismiss(id), ms);
      });
    }
  }, [paused, dismiss]);

  /* Timers outlive the render that made them; nothing else clears them if the
     provider goes. */
  useEffect(() => () => timers.current.forEach((e) => e.handle && clearTimeout(e.handle)), []);

  const measure = (id) => (el) => {
    if (!el) return;
    const h = el.offsetHeight;
    setHeights((m) => (m[id] === h ? m : { ...m, [id]: h }));
  };

  const toast = useCallback(
    (msg, type = "info", sub = "", action = null) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, msg, type, sub, action }]);
      // Auto-dismiss (longer if there's an action to click).
      arm(id, action ? 8000 : 4500);
      return id;
    },
    [arm]
  );

  /**
   * A toast that reports on work in progress instead of announcing something
   * that already happened.
   *
   * It carries a ring rather than an icon, and it does NOT dismiss itself:
   * a countdown would be measuring the wrong thing entirely, since what it is
   * waiting for is the work, not the reader. `settle` is what ends it.
   */
  const progressToast = useCallback((msg, sub = "") => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, msg, sub, type: "info", ring: { pct: 0, state: "busy" } }]);
    return id;
  }, []);

  /** Move a live toast on: new words, new position on the ring, or both. */
  const updateToast = useCallback((id, patch) => {
    setToasts((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (patch.ring) next.ring = { ...t.ring, ...patch.ring };
        return next;
      })
    );
  }, []);

  /* The last word, then it leaves on its own -- slower than an ordinary toast,
     because the tick landing is the thing the reader has been waiting for and
     it should not be snatched away the moment it arrives. */
  const settleToast = useCallback(
    (id, patch, after = 4000) => {
      updateToast(id, patch);
      arm(id, after);
    },
    [arm, updateToast]
  );

  /* Only three stand. A fourth pushes the oldest out, and the one thing never
     pushed is a live toast -- it is the only card here that is still happening
     rather than reporting something that already did. */
  useEffect(() => {
    const alive = toasts.filter((t) => !t.leaving);
    const over = alive.length - MAX_SHOWN;
    if (over <= 0) return;
    alive.filter((t) => !t.ring).slice(0, over).forEach((t) => dismiss(t.id));
  }, [toasts, dismiss]);

  /**
   * The deck, front card first.
   *
   * Newest in front, because the message you just caused is the one you are
   * looking for -- except that a live toast outranks everything. Burying a
   * progress ring behind "Chat deleted" hides the only thing on screen that is
   * still moving.
   *
   * `fanY` is how far up a card travels when the deck is hovered: past every
   * card in front of it. It is accumulated here rather than expressed in CSS
   * because the cards are not the same height.
   */
  const pile = useMemo(() => {
    const byNewest = (a, b) => b.id - a.id;
    const ordered = [
      ...toasts.filter((t) => t.ring).sort(byNewest),
      ...toasts.filter((t) => !t.ring).sort(byNewest),
    ];
    let acc = 0;
    return ordered.map((t, i) => {
      const fanY = acc;
      acc += (heights[t.id] ?? GUESS_H) + FAN_GAP;
      return { ...t, i, fanY, fanTotal: acc - FAN_GAP };
    });
  }, [toasts, heights]);

  /* Collapsed, the deck is exactly its front card; fanned, it is all of them.
     The container has to grow with it or the pointer leaves the box it just
     opened and the deck shuts under its own hover. */
  const pileH = pile.length ? heights[pile[0].id] ?? GUESS_H : 0;
  const fanH = pile.length ? pile[pile.length - 1].fanTotal : 0;

  return (
    <ToastContext.Provider
      value={{ toast, progressToast, updateToast, settleToast, dismissToast: dismiss }}
    >
      {children}
      <div id="toasts" role="status" aria-live="polite"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        style={{ "--pile-h": `${pileH}px`, "--pile-fan-h": `${fanH}px` }}>
        {pile.map((t) => (
          <div key={t.id} className="t-slot" style={{ "--i": t.i, "--fan-y": t.fanY }}>
          <div ref={measure(t.id)}
            className={`toast ${t.type} ${t.ring ? "is-live" : ""} ${t.leaving ? "leaving" : ""}`}>
            {t.ring ? (
              <span className={`t-ring ${t.ring.state}`}>
                <span className="t-ring-track" />
                {/* The filled arc is a conic gradient with its middle punched
                    out, which is the only way to draw a partial ring without a
                    second element rotating on top of the first. */}
                <span
                  className="t-ring-fill"
                  style={{ "--deg": `${Math.max(0, Math.min(100, t.ring.pct)) * 3.6}deg` }}
                />
                <span className="t-ring-cap">
                  {t.ring.state === "fail" ? (
                    <Icon name="x" className="t-ring-ic" />
                  ) : (
                    <span className="t-tick" />
                  )}
                </span>
              </span>
            ) : (
              <span className="t-ic"><Icon name={ICON[t.type] || "info"} className="icon-sm" /></span>
            )}
            <div className="t-msg">
              <span className="t-text">{t.msg}</span>
              {/* A progress toast keeps the row even while it is empty. The
                  detail comes and goes between phases, and a box that changes
                  height under a reader who is watching it is worse than a
                  blank line. */}
              {(t.sub || t.ring) && <span className="t-sub">{t.sub}</span>}
              {t.action && (
                <button
                  className="t-act"
                  onClick={() => {
                    t.action.cb?.();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button className="btn-icon" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="x" className="icon-sm" />
            </button>
          </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return (
    useContext(ToastContext) || {
      toast: () => {},
      progressToast: () => 0,
      updateToast: () => {},
      settleToast: () => {},
      dismissToast: () => {},
    }
  );
}
