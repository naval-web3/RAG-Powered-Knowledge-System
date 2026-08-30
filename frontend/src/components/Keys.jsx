import Icon from "./Icon";

/**
 * A keyboard shortcut, drawn rather than spelled out.
 *
 * No plus signs between the keys: they read as part of the shortcut when they
 * are only glue, and at 10px they crowd the letters they are separating. A gap
 * says the same thing and takes less room.
 *
 * Shift is the arrow the key itself is printed with on the keyboard, so the
 * hint on screen matches the thing you are reaching for.
 */
const LABELS = {
  ctrl: "Ctrl",
  alt: "Alt",
  cmd: "Cmd",
  meta: "Cmd",
  esc: "Esc",
  enter: "Enter",
  tab: "Tab",
};

export default function Keys({ combo, className = "" }) {
  const parts = combo
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  return (
    <kbd className={`keys ${className}`.trim()}>
      {parts.map((part, i) =>
        part === "shift" ? (
          <Icon key={i} name="shift" className="keys-shift" />
        ) : (
          <span key={i}>{LABELS[part] || part.toUpperCase()}</span>
        )
      )}
    </kbd>
  );
}
