/**
 * Tooltip — a small dark label shown on hover or keyboard focus.
 *
 * The native title attribute cannot be styled and waits about a second, so
 * this replaces it. Wrap any control; the delay and animation live in CSS so
 * nothing runs in JS while you are simply moving the mouse across a toolbar.
 */
export default function Tooltip({ label, keys, children }) {
  return (
    <span className="tip-wrap">
      {children}
      <span className="tip" role="tooltip">
        {label}
        {keys && <span className="tip-keys">{keys}</span>}
      </span>
    </span>
  );
}
