/**
 * Icon — renders one of the SVG symbols from the sprite in index.html.
 * Usage: <Icon name="spark" />  ·  <Icon name="trash" className="icon-sm" />
 */
export default function Icon({ name, className = "icon", ...rest }) {
  return (
    <svg className={className} aria-hidden="true" {...rest}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
