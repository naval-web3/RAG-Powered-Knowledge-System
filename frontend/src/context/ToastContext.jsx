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

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type} ${t.leaving ? "leaving" : ""}`}>
            <span className="t-ic"><Icon name={ICON[t.type] || "info"} className="icon-sm" /></span>
            <div className="t-msg">
              {t.msg}
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
  return useContext(ToastContext) || { toast: () => {} };
}
