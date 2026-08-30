import { useEffect } from "react";
import { useLocale } from "../i18n";
import useEdgeFade from "../useEdgeFade";
import { LANGUAGES } from "../i18n/languages";
import Icon from "./Icon";

/**
 * The language picker: every language at once, in three columns, rather than a
 * dropdown you have to scroll blind. Each entry gives the language's own name
 * above its English name, so someone who has landed in a script they cannot
 * read can still find their way back out.
 */
export default function LanguageDialog({ onClose }) {
  const { locale, setLocale, t } = useLocale();
  const [gridRef, fade] = useEdgeFade();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay lang-overlay" onClick={onClose}>
      <div className="modal lang-modal" role="dialog" aria-modal="true"
        aria-label={t("lang.title")} onClick={(e) => e.stopPropagation()}>
        <div className="lang-head">
          <h3>{t("lang.title")}</h3>
          <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className={`lang-grid ${fade}`} ref={gridRef}>
          {LANGUAGES.map((l) => (
            <button key={l.id} className={`lang-card ${l.id === locale ? "selected" : ""}`}
              lang={l.id} aria-current={l.id === locale}
              onClick={() => { setLocale(l.id); onClose(); }}>
              <span className="lang-native">{l.native}</span>
              <span className="lang-english">{l.english}</span>
              {l.id === locale && <Icon name="check" className="icon-sm lang-check" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
