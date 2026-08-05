import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import Stamp from "../components/Stamp";
import AdSlot from "../components/AdSlot";
import ShareButton from "../components/ShareButton";
import { loadRestaurants } from "../lib/data";
import { HALL_OF_SHAME } from "../lib/hallOfShame";
import { getAnonymizedViolationShareMessage } from "../lib/share";
import { detectPests } from "../lib/pests.mjs";
// Imported statically now that it's just the drop animation. It builds its
// state inside useEffect, so it renders nothing on the server and there's no
// hydration mismatch -- the lazy chunk was buying nothing and made the thing
// harder to verify shipped.
import ShameCritters from "../components/ShameCritters";

// Reads from the same build-time restaurants.json every other page not on
// the ISR path uses (homepage, neighborhood pages) -- always this
// restaurant's CURRENT grade/violations, never a stale copy baked into
// hallOfShame.js itself. Only the curation (which restaurant, which
// violation, whether it's revealed) lives in that file.
export async function getStaticProps() {
  const restaurants = loadRestaurants();
  const total = restaurants.length;

  // Entries are addressed by a distinctive fragment of the violation text,
  // searched across the current inspection AND the full history.
  //
  // The previous approach indexed into r.v -- the CURRENT violations -- which
  // silently rotted: once a restaurant is re-inspected that array is replaced,
  // so an entry either vanished (5 of 16 had) or, worse, kept a valid index
  // and displayed an unrelated violation under the curated caption. Matching
  // on text means an entry either resolves to the violation that was actually
  // curated or resolves to nothing at all.
  const entries = HALL_OF_SHAME.map((entry) => {
    const r = restaurants.find((x) => x.slug === entry.slug);
    if (!r) return null;

    let violation = null;
    let inspectionDate = r.d;

    if (entry.match) {
      const needle = entry.match.toLowerCase();
      const hit = (r.v || []).find((v) => (v.t || "").toLowerCase().includes(needle));
      if (hit) {
        violation = hit;
      } else {
        for (const past of r.hi || []) {
          const pastHit = (past.v || []).find((v) => (v.t || "").toLowerCase().includes(needle));
          if (pastHit) {
            violation = pastHit;
            inspectionDate = past.d;
            break;
          }
        }
      }
    } else if (typeof entry.violationIndex === "number") {
      // Legacy entries, kept working until they're migrated to `match`.
      violation = (r.v || [])[entry.violationIndex] || null;
    }

    if (!violation) return null;
    return {
      slug: entry.slug,
      revealed: entry.revealed,
      caption: entry.caption,
      n: entry.revealed ? r.n : null,
      nb: r.nb,
      d: inspectionDate,
      g: r.g,
      // A featured violation from an earlier inspection shouldn't imply the
      // place is still in that state -- the page says so where it's true.
      historical: inspectionDate !== r.d,
      violation,
    };
  }).filter(Boolean);

  return { props: { entries, total }, revalidate: 3600 };
}

export default function HallOfShame({ entries, total }) {
  const title = "Hall of Shame \u2014 Notable Chicago Health Inspection Findings | GutCheck";
  const description =
    "Some of the more notable violations found in recent Chicago restaurant health inspections, sourced directly from the City of Chicago's official public records.";
  const url = "https://www.gutcheckchicago.com/hall-of-shame";

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://www.gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.gutcheckchicago.com/og/default.webp" />
      </Head>

      <ShameCritters />

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
        <AdSlot variant="banner" />
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
              {entry.historical && (
                <span className="shame-historical">
                  {" \u00b7 "}since re-inspected
                </span>
              )}
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
                {detectPests(entry.violation.t).length > 0 && (
                  <div className="pest-tags">
                    {detectPests(entry.violation.t).map((p) => (
                      <span key={p.key} className="pest-tag">
                        <span aria-hidden="true">{p.emoji}</span> {p.label}
                      </span>
                    ))}
                  </div>
                )}
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
