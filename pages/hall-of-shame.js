import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import Stamp from "../components/Stamp";
import ShareButton from "../components/ShareButton";
import { loadRestaurants } from "../lib/data";
import { HALL_OF_SHAME } from "../lib/hallOfShame";
import { getAnonymizedViolationShareMessage } from "../lib/share";

// Reads from the same build-time restaurants.json every other page not on
// the ISR path uses (homepage, neighborhood pages) -- always this
// restaurant's CURRENT grade/violations, never a stale copy baked into
// hallOfShame.js itself. Only the curation (which restaurant, which
// violation, whether it's revealed) lives in that file.
export async function getStaticProps() {
  const restaurants = loadRestaurants();
  const total = restaurants.length;

  const entries = HALL_OF_SHAME.map((entry) => {
    const r = restaurants.find((x) => x.slug === entry.slug);
    if (!r) return null;
    const violation = r.v[entry.violationIndex];
    if (!violation) return null;
    return {
      slug: entry.slug,
      revealed: entry.revealed,
      caption: entry.caption,
      n: entry.revealed ? r.n : null,
      nb: r.nb,
      d: r.d,
      g: r.g,
      violation,
    };
  }).filter(Boolean);

  return { props: { entries, total }, revalidate: 3600 };
}

export default function HallOfShame({ entries, total }) {
  const title = "Hall of Shame \u2014 Notable Chicago Health Inspection Findings | GutCheck";
  const description =
    "Some of the more notable violations found in recent Chicago restaurant health inspections, sourced directly from the City of Chicago's official public records.";
  const url = "https://gutcheckchicago.com/hall-of-shame";

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://gutcheckchicago.com/og/default.webp" />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">Notable findings \u00b7 official public data</div>
        <h1>HALL OF SHAME.</h1>
        <p>
          Some of the more notable violations turned up in recent Chicago health inspections, straight from
          the City of Chicago&rsquo;s own records. Restaurant names are withheld for now.
        </p>
      </div>

      <div className="wrap section" style={{ maxWidth: 760 }}>
        {entries.map((entry, i) => (
          <div className="shame-card" key={entry.slug} id={`entry-${i + 1}`}>
            <div className="shame-card-head">
              <span className={`shame-name ${entry.revealed ? "" : "shame-name-hidden"}`}>
                {entry.revealed ? entry.n : "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588"}
              </span>
              <Stamp grade={entry.g} size="sm" />
            </div>
            <div className="shame-card-meta">
              {entry.nb}, Chicago \u00b7 {entry.d}
            </div>
            {entry.caption && <p className="shame-caption">{entry.caption}</p>}
            <div
              className={`violation ${entry.violation.s === "c" ? "critical" : "noncritical"}`}
              style={{ marginTop: 10 }}
            >
              <AlertTriangle
                size={16}
                color={entry.violation.s === "c" ? "var(--stamp-red)" : "var(--amber)"}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div className="violation-body">
                <div className="violation-text">{entry.violation.t}</div>
                <div className="violation-sev">{entry.violation.s === "c" ? "priority violation" : "core violation"}</div>
              </div>
            </div>
            {entry.revealed ? (
              <Link href={`/r/${entry.slug}`} className="contact-chip" style={{ marginTop: 12 }}>
                View full report
              </Link>
            ) : (
              <div style={{ marginTop: 12 }}>
                <ShareButton
                  url={`${url}#entry-${i + 1}`}
                  message={getAnonymizedViolationShareMessage(entry.violation, entry.g)}
                  emailSubject="Chicago health inspection finding"
                />
              </div>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="empty">No entries yet.</div>
        )}
      </div>

      <Footer />
    </div>
  );
}
