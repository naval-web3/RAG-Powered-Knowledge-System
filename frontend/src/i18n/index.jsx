import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_LOCALE, isLocale, languageOf } from "./languages";
import STRINGS from "./strings";

/**
 * Interface language.
 *
 * What gets translated is the furniture: the sidebar, the menus, the dialogs,
 * every label and empty state. What does NOT get translated is anything the
 * user or the model wrote -- conversation titles, messages, document names.
 * A chat is in the language it was held in, and re-labelling the history each
 * time the setting changes would be a lie about what is in it.
 *
 * The preference is per browser, like the theme, and applies before sign-in.
 */
const KEY = "retrieva-locale";
const LocaleContext = createContext(null);

export function readLocale() {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
    // Fall back to the browser's own preference when it is one we speak, so a
    // Hindi browser opens in Hindi without anyone touching a setting.
    const nav = navigator.language || "";
    if (isLocale(nav)) return nav;
    const base = nav.split("-")[0];
    const match = Object.keys(STRINGS).find((id) => id.split("-")[0] === base);
    return match || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function applyLocale(id = readLocale()) {
  const lang = languageOf(id);
  document.documentElement.setAttribute("lang", id);
  document.documentElement.setAttribute("dir", lang.dir);
}

/** Fill {name} placeholders. Values are inserted as text, never as markup. */
function fill(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole
  );
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readLocale);

  const setLocale = useCallback((id) => {
    if (!isLocale(id)) return;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private mode: it still applies for this session */
    }
    applyLocale(id);
    setLocaleState(id);
  }, []);

  /* Missing keys fall through to English rather than showing the key itself:
     a half-translated locale then reads as a mix of languages, which is
     awkward but usable, where "sidebar.newChat" on a button is not. */
  const t = useMemo(() => {
    const dict = STRINGS[locale] || {};
    const base = STRINGS[DEFAULT_LOCALE];
    return (key, vars) => fill(dict[key] ?? base[key] ?? key, vars);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  // A default keeps components renderable outside the provider, which is what
  // the smoke test does when it mounts a page on its own.
  return (
    useContext(LocaleContext) || {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => fill(STRINGS[DEFAULT_LOCALE][key] ?? key, vars),
    }
  );
}

/** Shorthand for the common case of needing only the translator. */
export function useT() {
  return useLocale().t;
}
