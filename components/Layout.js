import Link from "next/link";
import { Utensils } from "lucide-react";

export function Nav({ total }) {
  return (
    <div className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <Utensils size={20} strokeWidth={2.5} />
          <span className="brand-name">GUTCHECK</span>
        </Link>
        <div className="nav-count">
          CHICAGO · {total.toLocaleString()} RESTAURANTS ·{" "}
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" /> LIVE DATA
          </span>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <div className="footer">
      <div className="wrap footer-inner">
        <p>
          Independent service — not affiliated with the City of Chicago, Cook County, or any
          restaurant. Health inspection data sourced directly from the City of Chicago's public
          Food Inspections open-data feed (data.cityofchicago.org, dataset 4ijn-s7e5), rebuilt
          from the live feed on every deploy. Neighborhood is derived from ZIP code and is
          approximate.
        </p>
        <div className="footer-links">
          <Link href="/faq">FAQ</Link>
          <Link href="/about">About the data</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <a href="mailto:hello@gutcheckchicago.com">Contact</a>
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
      </div>
    </div>
  );
}
