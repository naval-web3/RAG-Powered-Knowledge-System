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

/** Up to two uppercase initials from a name or email. */
export function initialsOf(name) {
  if (!name) return "?";
  const base = name.includes("@") ? name.split("@")[0] : name;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name) {
  if (!name) return "there";
  const base = name.includes("@") ? name.split("@")[0] : name;
  return base.trim().split(/[\s._-]+/)[0] || "there";
}

export function greetingFor(name) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${firstName(name)}`;
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
