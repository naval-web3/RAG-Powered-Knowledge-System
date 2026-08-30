/** Small formatting/helper utilities shared across pages. */

export function fmtBytes(b) {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(dateish) {
  if (!dateish) return "—";
  const d = new Date(dateish);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "a minute ago";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDate(dateish) {
  if (!dateish) return "—";
  return new Date(dateish).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Up to two uppercase initials from a name or email: first letter of the first
 * name plus first letter of the last, or the first two letters when there is
 * only one name.
 *
 * camelCase counts as a word boundary, so "demoUser" reads as two names and
 * gives DU rather than DE.
 */
export function initialsOf(name) {
  if (!name) return "?";
  const base = name.includes("@") ? name.split("@")[0] : name;
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const parts = spaced.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The first name, capitalised. camelCase counts as a word boundary for the
 * same reason it does in initialsOf: "demoUser" is two names, so the greeting
 * uses "Demo" rather than "DemoUser".
 */
export function firstName(name) {
  if (!name) return "there";
  const base = name.includes("@") ? name.split("@")[0] : name;
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const first = spaced.trim().split(/[\s._-]+/)[0];
  if (!first) return "there";
  return first[0].toUpperCase() + first.slice(1);
}

let lastPrompt = null;

function nextPrompt(prompts) {
  // Never the same line twice running.
  const pool = prompts.filter((p) => p !== lastPrompt) ;
  lastPrompt = pool[Math.floor(Math.random() * pool.length)] || prompts[0];
  return lastPrompt;
}

function bandNow() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/* Longer than any given name anyone actually has, and short enough that
   "Good afternoon, " plus a name still reads as a greeting rather than a
   headline. Display only: nobody is stopped from having a longer name, it is
   just not all shouted at 34px. */
const GREETING_NAME_MAX = 20;

/**
 * The line above the composer on an empty chat.
 *
 * The session's opening screen is the only place a name is used: being greeted
 * by name on arrival reads as recognition, where repeating it on every new chat
 * would read as a tic. Every chat after the first opens with a prompt instead.
 *
 * `t` is passed in rather than imported so this stays a plain function; the
 * rotating prompts arrive as one "|"-joined string and are split here.
 */
export function greetingFor(t, name, arrival = true) {
  if (arrival) {
    const first = firstName(name);
    const shown =
      first.length > GREETING_NAME_MAX
        ? `${first.slice(0, GREETING_NAME_MAX).trimEnd()}…`
        : first;
    return t(`chat.greeting.${bandNow()}`, { name: shown });
  }
  return nextPrompt(t("chat.prompts").split("|"));
}

/** Password strength → { level: 0-4, label }. */
export function strengthOf(v) {
  if (!v) return { level: 0, label: "" };
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  const level = Math.min(score, 4);
  const label = ["", "Weak", "Fair", "Good", "Strong"][level];
  return { level, label };
}

/** Short label for a file type, used by the file-type icon chip. */
export function fileExt(fileType, filename) {
  const t = (fileType || "").toLowerCase();
  if (t) return t;
  const m = (filename || "").split(".").pop();
  return (m || "").toLowerCase();
}
