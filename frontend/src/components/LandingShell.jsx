import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { getThemePref, setTheme } from "../theme";

const REPO = "https://github.com/naval-web3/RAG-Powered-Knowledge-System";

/* The three public pages, in nav order. The same list draws the footer's
   Product column, so a page can never appear in one and not the other. */
export const LAND_PAGES = [
  { to: "/welcome", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/under-the-hood", label: "Under the hood" },
];

const THEMES = [
  { id: "system", icon: "monitor", label: "Match system" },
  { id: "light", icon: "sun", label: "Light" },
  { id: "dark", icon: "moon", label: "Dark" },
];

/**
 * The chrome every public page shares: the docking nav, and the footer.
 * Pages pass their own sections as children and own nothing else.
 */
export default function LandingShell({ children, id }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /* The nav rides as a centred pill at the top of the page and docks into a
     full-bleed bar once you scroll past it. */
  const [docked, setDocked] = useState(false);
  const tripRef = useRef(null);
  const [themePref, setThemePref] = useState(getThemePref);

  const linksRef = useRef(null);
  const inkRef = useRef(null);

  const pickTheme = (pref) => {
    setTheme(pref);
    setThemePref(pref);
  };

  /* Watch a fixed 80px sentinel pinned to the top of the page rather than
     sampling window.scrollY. The sentinel sits outside the flow, so the nav
     resizing cannot move it: the state flips once, at exactly one offset,
     with no chance of the threshold re-firing mid-transition. */
  useEffect(() => {
    const trip = tripRef.current;
    if (!trip || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setDocked(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(trip);
    return () => io.disconnect();
  }, []);

  /* The hairline under the nav is written straight to the node's style rather
     than held in state: it follows the pointer from link to link, and a
     re-render on every mouseenter would be a lot of machinery to draw one
     1px bar. Nothing else reads its position. */
  const moveInk = (el) => {
    const links = linksRef.current;
    const ink = inkRef.current;
    if (!links || !ink) return;
    if (!el) {
      links.classList.remove("has-ink");
      return;
    }
    ink.style.transform = `translateX(${el.offsetLeft}px) scaleX(${el.offsetWidth})`;
    links.classList.add("has-ink");
  };

  /* NavLink marks the active route with aria-current, so the current link is
     read back off the DOM rather than matched against the path a second time. */
  const currentLink = () =>
    linksRef.current ? linksRef.current.querySelector('a[aria-current="page"]') : null;

  useEffect(() => {
    const ink = inkRef.current;
    if (!ink) return undefined;
    /* Land on the new page's link rather than sliding across from the old
       one, which would read as a pointer moving on its own. */
    ink.style.transition = "none";
    moveInk(currentLink());
    const frame = requestAnimationFrame(() => {
      ink.style.transition = "";
    });

    const settle = () => moveInk(currentLink());
    window.addEventListener("resize", settle);
    /* Inter arriving changes every link's width, and the bar is sized to one
       of them. Measuring again once the face is in is cheaper than guessing. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", settle);
    };
  }, [pathname]);

  return (
    <div id={id} className="screen land-page">
      <div ref={tripRef} className="nav-trip" aria-hidden="true" />
      <nav className={docked ? "land-nav is-docked" : "land-nav"}>
        <div className="land-nav-bar">
          <div className="land-nav-row">
            <Link className="brand" to="/welcome">
              <img className="brand-mark" src="/logo.png" alt="" width="32" height="32" />
              <div>
                <span className="brand-name">Retrieva</span>
                <span className="brand-sub">RAG Knowledge System</span>
              </div>
            </Link>
            <div
              className="nav-links"
              ref={linksRef}
              onMouseLeave={() => moveInk(currentLink())}
            >
              {LAND_PAGES.map((p) => (
                <NavLink key={p.to} to={p.to} onMouseEnter={(e) => moveInk(e.currentTarget)}>
                  {p.label}
                </NavLink>
              ))}
              <span className="nav-ink" ref={inkRef} aria-hidden="true" />
            </div>
            <div className="nav-cta">
              <button className="btn btn-ghost" onClick={() => navigate("/login")}>Sign in</button>
              <button className="btn btn-primary btn-shine" onClick={() => navigate("/register")}>Get started</button>
            </div>
          </div>
        </div>
      </nav>

      {children}

      <footer className="land-footer">
        <div className="foot-top">
          <div className="foot-brand">
            <div className="foot-logo">
              <img src="/logo.png" alt="" width="30" height="30" />
              <span>Retrieva</span>
            </div>
            <p className="foot-tagline">Answers you can trace back to the page they came from.</p>
          </div>

          <nav className="foot-cols" aria-label="Footer">
            <div className="foot-col">
              <h4>Product</h4>
              {LAND_PAGES.map((p) => (
                <Link key={p.to} to={p.to}>{p.label}</Link>
              ))}
            </div>
            <div className="foot-col">
              <h4>Get started</h4>
              <Link to="/register">Create an account</Link>
              <Link to="/login">Sign in</Link>
              <Link to="/forgot-password">Reset password</Link>
            </div>
            <div className="foot-col">
              <h4>Project</h4>
              <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
              <span>MCSP-232 · MCA</span>
              <span>IGNOU · RC Shimla</span>
            </div>
          </nav>
        </div>

        <div className="foot-bottom">
          <span>© 2026 Retrieva · RAG Powered Knowledge System</span>
          <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={themePref === t.id}
                aria-label={t.label}
                title={t.label}
                onClick={() => pickTheme(t.id)}
              >
                <Icon name={t.icon} />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** The closing invitation that ends both sub-pages. */
export function CtaBand() {
  const navigate = useNavigate();
  return (
    <div className="cta-band">
      <div>
        <h2>Try it on your own documents</h2>
        <p>
          Upload a PDF and ask it something. Or use the demo user and demo admin shortcuts on
          the sign-in page first.
        </p>
      </div>
      <div className="hero-cta">
        <button className="btn btn-primary btn-lg btn-shine" onClick={() => navigate("/register")}>
          Create your knowledge base <Icon name="arrow-r" className="icon-sm" />
        </button>
        <button className="btn btn-outline btn-lg" onClick={() => navigate("/login")}>Sign in</button>
      </div>
    </div>
  );
}
