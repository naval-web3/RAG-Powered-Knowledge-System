/**
 * Theme handling — sets data-theme on <html>, persisted in localStorage.
 * Preference is "light" | "dark" | "system" (default). "system" follows the OS.
 */
const KEY = "retrieva-theme";
const mql = window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePref() {
  return localStorage.getItem(KEY) || "system";
}

export function resolvedTheme(pref = getThemePref()) {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return mql.matches ? "dark" : "light";
}

export function applyTheme(pref = getThemePref()) {
  document.documentElement.setAttribute("data-theme", resolvedTheme(pref));
}

export function setTheme(pref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

/** Toggle between light and dark (collapses "system" to its opposite). */
export function toggleTheme() {
  const next = resolvedTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Re-apply when the OS theme changes and the user is on "system".
mql.addEventListener("change", () => {
  if (getThemePref() === "system") applyTheme("system");
});
