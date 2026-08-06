import Link from "next/link";
import dynamic from "next/dynamic";

// Client-only: it lazy-loads lottie-web from an IntersectionObserver, and
// there is nothing to server-render for a decorative badge.
const BackspaceBadge = dynamic(() => import("./BackspaceBadge"), { ssr: false });

export function Nav({ total }) {
  return (
    <div className="nav">
      {/* 165 focusable elements sit between the top of the page and the
          first result, most of them neighbourhood chips. Without this a
          keyboard user tabs through all of them on every single page. */}
      <a href="#main" className="skip-link">Skip to main content</a>
      {/* Rendered inside Nav so every page gets the target from one edit. */}
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <img className="brand-mark" src="/gutcheck-mark.png" alt="" width="20" height="20" />
          <span className="brand-name">GUTCHECK</span>
        </Link>
        <div className="nav-count">
          {/* Plain clickable text, not a button -- it's a way back home,
              not an action worth competing with the logo. */}
          <Link href="/" className="nav-count-link">
            CHICAGO · {total.toLocaleString()} RESTAURANTS &amp; BARS
          </Link>{" "}
          ·{" "}
          {/* Outlined, deliberately quiet. The pulse already draws the eye;
              a filled accent here would read as the page's primary action,
              which it isn't. */}
          <Link href="/data" className="live-badge" title="See our analysis of Chicago inspection data">
            <span className="live-dot" aria-hidden="true" /> LIVE DATA
          </Link>
        </div>
      </div>
      <span id="main" tabIndex={-1} className="skip-target" />
    </div>
  );
}

export function Footer() {
  return (
    <div className="footer">
      <div className="wrap footer-inner">
        {/* Brand mark and wordmark, matching the nav lockup. Decorative here --
            the nav already carries the linked, labelled version. */}
        <div className="footer-brand" aria-hidden="true">
          <img className="footer-mark" src="/gutcheck-mark.png" alt="" width="22" height="22" />
          <span className="footer-wordmark">GUTCHECK</span>
        </div>
        <p>
          Independent service — not affiliated with the City of Chicago, Cook County, or any
          restaurant. Health inspection data sourced directly from the City of Chicago's public
          Food Inspections open-data feed (data.cityofchicago.org, dataset 4ijn-s7e5), rebuilt
          from the live feed on every deploy. Neighborhood is derived from ZIP code and is
          approximate.
        </p>
        <div className="footer-links">
          <Link href="/faq">FAQ</Link>
          <Link href="/data">Inspection data analysis</Link>
          <Link href="/food-inspection-map">Inspection map</Link>
          <Link href="/reports">Custom reports</Link>
          <Link href="/about">About the data</Link>
          <Link href="/violations">Violation codes</Link>
          <Link href="/new-restaurants">New restaurants</Link>
          <Link href="/closed-restaurants">Recently closed</Link>
          <Link href="/hall-of-shame">
            {/* Decorative only. aria-hidden so a screen reader announces
                "Hall of Shame" rather than "fly, Hall of Shame" -- the emoji
                carries no meaning the link text does not already carry.
                Neutral for SEO either way; Google does not treat emoji as a
                ranking signal, and the anchor text is unchanged. */}
            <span aria-hidden="true">&#129712;</span> Hall of Shame
          </Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <a href="mailto:GUTCHECKChicago@builtbybackspace.com">Contact</a>
        </div>
        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} All Rights Reserved{" \u00B7 "}
          Built by{" "}
          <a href="https://www.builtbybackspace.com/" target="_blank" rel="noopener noreferrer">
            Built By Backspace, LLC
          </a>
          {" \u2013 "}
          <a href="https://www.websitedesign-chicago.com/" target="_blank" rel="noopener noreferrer">
            Website Design Chicago
          </a>
        </div>
        <BackspaceBadge />
      </div>
    </div>
  );
}
