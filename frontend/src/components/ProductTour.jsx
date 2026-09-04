import { useEffect, useRef } from "react";
import markup from "../tour/markup";
import { mount } from "../tour/retrievaTour";

/**
 * The product tour on the landing page: a canned copy of the workspace that a
 * visitor can click through.
 *
 * The module inside is plain browser JS that writes its own DOM. It was
 * written for the static preview and is ported unchanged, so React has to keep
 * its hands off the subtree: the markup goes in ONCE, through
 * dangerouslySetInnerHTML from a constant string, which React then never
 * reconciles again -- had it been JSX, the next render of this page would have
 * wiped every row the tour had drawn.
 *
 * The host is display: contents, so the section it wraps is still a direct
 * child of the landing column and the spacing is the preview's own.
 *
 * mount() stamps the node it mounts, so StrictMode's double effect in
 * development builds one tour rather than two.
 */
export default function ProductTour() {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) mount(ref.current);
  }, []);
  return <div className="tour-host" ref={ref} dangerouslySetInnerHTML={{ __html: markup }} />;
}
