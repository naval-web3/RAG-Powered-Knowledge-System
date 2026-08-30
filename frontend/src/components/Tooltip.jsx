/**
 * Tooltip — a small dark label shown on hover or keyboard focus.
 *
 * The native title attribute cannot be styled and waits about a second, so
 * this replaces it. Wrap any control; the delay and animation live in CSS so
 * nothing runs in JS while you are simply moving the mouse across a toolbar.
 *
 * `placement` is chosen at the call site rather than measured, which is what
 * keeps this free of JS, and it has to be chosen with the control's position in
 * mind. A "bottom" tooltip on a button in the last inch of the window is cut
 * off by the window; one on a button at the foot of the sidebar falls off the
 * screen. Reach for "left" at the right edge and "top" near the bottom.
 */
export default function Tooltip({ label, keys, placement = "bottom", children }) {
  return (
    <span className={`tip-wrap tip-${placement}`}>
      {children}
      <span className="tip" role="tooltip">
        {label}
        {keys && <span className="tip-keys">{keys}</span>}
      </span>
    </span>
  );
}
