/**
 * Ghost — the mark for private chat.
 *
 * Inline rather than a symbol in the sprite like every other icon here, and for
 * one reason: its eyes are animated on their own, and CSS cannot reach inside
 * the shadow tree that `<use>` creates. Drawn as separate elements, they are
 * ordinary children that a stylesheet can address.
 *
 * The body keeps the two subpaths it came with — an outer edge and an inner one
 * — so the shape reads as a thin outline rather than a filled silhouette.
 */
export default function Ghost({ className = "icon", ...rest }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M220,120v96a4.00007,4.00007,0,0,1-6.5332,3.0957L186.667,197.168,159.86621,219.0957a4.00069,4.00069,0,0,1-5.06641,0L128,197.168,101.2002,219.0957a4.00069,4.00069,0,0,1-5.06641,0L69.333,197.168,42.5332,219.0957A4,4,0,0,1,36,216V120a92,92,0,0,1,184,0Zm-8,0a84,84,0,0,0-168,0v87.55908L66.7998,188.9043a4.00069,4.00069,0,0,1,5.06641,0L98.667,210.832,125.4668,188.9043a4.00025,4.00025,0,0,1,5.0664,0L157.333,210.832l26.80078-21.92773a4.00069,4.00069,0,0,1,5.06641,0L212,207.55908Z" />
      {/* Both eyes carry the same class and so glance together: two eyes that
          moved independently would not read as looking at anything. */}
      <circle className="ghost-eye" cx="100" cy="116" r="8" />
      <circle className="ghost-eye" cx="156" cy="116" r="8" />
    </svg>
  );
}
