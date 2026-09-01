import { createContext, useCallback, useContext, useRef, useState } from "react";
import Icon from "../components/Icon";

const ToastContext = createContext(null);

const ICON = { ok: "check", err: "alert", warn: "alert", info: "info" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) =>
      list.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 250);
  }, []);

  const toast = useCallback(
    (msg, type = "info", sub = "", action = null) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, msg, type, sub, action }]);
      // Auto-dismiss (longer if there's an action to click).
      setTimeout(() => dismiss(id), action ? 8000 : 4500);
      return id;
    },
    [dismiss]
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
      setTimeout(() => dismiss(id), after);
    },
    [dismiss, updateToast]
  );

  return (
    <ToastContext.Provider
      value={{ toast, progressToast, updateToast, settleToast, dismissToast: dismiss }}
    >
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type} ${t.leaving ? "leaving" : ""}`}>
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
              {t.sub && <span className="t-sub">{t.sub}</span>}
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
