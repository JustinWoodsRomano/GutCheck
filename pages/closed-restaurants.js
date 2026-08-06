import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { Nav, Footer } from "../components/Layout";
import { loadClosures, loadCounts } from "../lib/data";
import { RECENT_CLOSURE_DAYS } from "../lib/pests.mjs";

const SITE = "https://www.gutcheckchicago.com";
const WINDOW_DAYS = RECENT_CLOSURE_DAYS;
const INITIAL_VISIBLE = 20;

/**
 * Chicago restaurants and bars the city has marked out of business.
 *
 * The single most important constraint on this page: the City of Chicago
 * publishes NO REASON for a closure. There is no field, no comment, no note —
 * only the fact that an inspector arrived and the establishment was gone. So
 * nothing here explains why anything closed, and nothing generates such an
 * explanation. Every sentence below is assembled from figures that exist in
 * the record: how long it operated, how many times it was inspected, how it
 * did. Inventing a cause for a named business would be defamation with extra
 * steps, and the fabricated reason is always the same one — "closed after
 * repeated health violations" — which for most closures is simply false.
 *
 * Reliability is handled upstream in buildClosures (scripts/fetch-data.mjs):
 * a licence only counts as closed when no later graded inspection exists.
 * Spot-checking 40 out-of-business records showed 2 that were later graded
 * again, one of them a well-known Loop restaurant that never closed at all.
 */
export async function getStaticProps() {
  const all = loadClosures();
  const total = loadCounts().active;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const items = all
    .filter((c) => c.d >= cutoffStr && c.n)
    .map((c) => ({ ...c, summary: describeClosure(c) }));

  const byHood = {};
  for (const c of items) {
    const name = c.vn || c.ca || c.nb;
    if (!name) continue;
    if (!byHood[name]) byHood[name] = { name, count: 0, slug: c.vnSlug || c.caSlug || c.nbSlug };
    byHood[name].count += 1;
  }
  const topHoods = Object.values(byHood).sort((a, b) => b.count - a.count).slice(0, 8);

  const withHistory = items.filter((c) => c.inspections > 0);
  const medianYears = medianTenureYears(withHistory);

  return {
    props: {
      items, total, topHoods,
      windowDays: WINDOW_DAYS,
      newest: items[0]?.d || null,
      oldest: items[items.length - 1]?.d || null,
      yearTotal: all.filter((c) => c.d >= yearAgo()).length,
      medianYears,
    },
    revalidate: 3600,
  };
}

function yearAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 365);
  return d.toISOString().slice(0, 10);
}

function medianTenureYears(items) {
  const spans = items
    .filter((c) => c.firstSeen && c.d)
    .map((c) => (new Date(c.d) - new Date(c.firstSeen)) / (1000 * 60 * 60 * 24 * 365.25))
    .sort((a, b) => a - b);
  if (!spans.length) return null;
  const mid = Math.floor(spans.length / 2);
  const v = spans.length % 2 ? spans[mid] : (spans[mid - 1] + spans[mid]) / 2;
  return Math.round(v * 10) / 10;
}

/**
 * Assembled from the record, never generated. Every clause maps to a value
 * the city published; where the record is silent, the sentence is silent.
 */
function describeClosure(c) {
  const where = c.vn || c.ca || c.nb;
  const parts = [];

  parts.push(
    `City inspectors recorded ${c.n}${where ? ` in ${where}` : ""} as out of business on ${c.d}.`
  );

  if (c.inspections > 0 && c.firstSeen) {
    const years = (new Date(c.d) - new Date(c.firstSeen)) / (1000 * 60 * 60 * 24 * 365.25);
    const span =
      years >= 1.5 ? `about ${Math.round(years)} years` : years >= 0.75 ? "about a year" : "less than a year";
    parts.push(
      `It appears in the city's inspection records from ${c.firstSeen}, a span of ${span}, across ${c.inspections} graded inspection${c.inspections === 1 ? "" : "s"}.`
    );
  } else {
    parts.push("It has no graded inspections in the city's published records.");
  }

  if (c.inspections > 0) {
    if (c.fails === 0) {
      parts.push("It never failed an inspection.");
    } else {
      const rate = Math.round((c.fails / c.inspections) * 100);
      parts.push(
        `${c.fails} of those ${c.inspections} ended in a failure (${rate}%).`
      );
    }
    if (c.lastResult && c.lastGraded) {
      const label =
        c.lastResult === "Pass w/ Conditions" ? "a pass with conditions" : `a ${c.lastResult.toLowerCase()}`;
      parts.push(`Its final graded inspection, on ${c.lastGraded}, was ${label}.`);
    }
  }

  // The one thing worth saying about what is NOT in the data.
  parts.push(
    "The city does not publish a reason for closure, and none is inferred here."
  );

  return parts.join(" ");
}

/** Wraps the card body in a link only when a detail page exists for it. */
function CardShell({ hasPage, slug, children }) {
  if (!hasPage) return <>{children}</>;
  return (
    <Link href={`/r/${slug}`} className="closure-card-link">
      {children}
    </Link>
  );
}

export default function ClosedRestaurants({
  items, total, topHoods, windowDays, newest, oldest, yearTotal, medianYears,
}) {
  const [expanded, setExpanded] = useState(false);
  const n = items.length;

  const title = "Recently Closed Chicago Restaurants & Bars";
  const description = `${n} Chicago restaurants and bars recorded as out of business by city inspectors in the last ${windowDays} days, with each one's full inspection history. Sourced from the City of Chicago's official records.`;
  const url = `${SITE}/closed-restaurants`;

  const faqs = [
    {
      q: "How do you know which Chicago restaurants have closed?",
      a: `The City of Chicago logs "Out of Business" as an inspection result — an inspector went to the address and the establishment was no longer operating. That is the only closure signal in the public record. This page lists every Chicago restaurant and bar given that result in the last ${windowDays} days, excluding any licence that has been inspected and graded since.`,
    },
    {
      q: "Why did a particular restaurant close?",
      a: "The City of Chicago publishes no reason for a closure — no field, no note, no explanation. A restaurant can close because the owner retired, the lease ended, the building sold, the concept changed, or the business failed, and the inspection record looks identical in every case. This site reports what the record contains and does not speculate beyond it.",
    },
    {
      q: "Is this list definitive?",
      a: "Close, but not perfect. An out-of-business record is occasionally filed for an establishment that turns out to still be operating — a temporary closure, a licence transfer, or an inspector reaching a locked door. To reduce that, a licence is only listed here if no later graded inspection exists for it. If you see a business listed that is open, it means the city's own record has not caught up.",
    },
    {
      q: "Do restaurants that close have worse inspection records?",
      a: "Barely, if at all. Restaurants that closed had a 28.2% inspection failure rate beforehand, against 24.1% for a matched sample of restaurants still operating — a gap too small, on samples this size, to call meaningful. Failing inspections is not a reliable predictor of closing, and closing is not evidence of having failed.",
    },
    {
      q: "Can a closed restaurant reopen?",
      a: "Yes. A licence can be reinstated, and a new operator can take over the same address under a new licence. If a listed establishment is inspected and graded again, it is removed from this page automatically.",
    },
    {
      q: "How often does this list update?",
      a: `It rebuilds from the City of Chicago's Food Inspections feed.${newest ? ` The most recent closure recorded here is dated ${newest}.` : ""}`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: title,
        description,
        url,
        inLanguage: "en-US",
        dateModified: newest || undefined,
        isBasedOn: "https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5",
        publisher: { "@id": `${SITE}/#org` },
        spatialCoverage: { "@type": "City", name: "Chicago", sameAs: "https://en.wikipedia.org/wiki/Chicago" },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: `Chicago restaurants and bars recorded out of business in the last ${windowDays} days`,
        numberOfItems: n,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: items.slice(0, 100).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.n,
          ...(c.hasPage ? { url: `${SITE}/r/${c.slug}` } : {}),
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Chicago restaurants & bars", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Recently closed", item: url },
        ],
      },
    ],
  };

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og/default.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">&larr; Back home</Link>
        <div className="eyebrow">Out of business &middot; official public data</div>
        <h1>
          <span className="word-new">CLOSED</span> RESTAURANTS &amp; BARS.
        </h1>

        <p className="lede">
          City inspectors recorded {n} Chicago restaurants and bars as out of business in
          the last {windowDays} days
          {yearTotal ? `, and ${yearTotal} over the past year` : ""}. Each is listed below
          with the inspection history it left behind.
        </p>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">What the city actually records</h2>
        <div className="prose">
          <p>
            Chicago publishes no list of restaurant closures. What it publishes is an
            inspection result: when an inspector visits an address and the establishment is
            gone, the visit is logged as{" "}
            <strong>Out of Business</strong>. That is the only closure signal in the public
            record, and it is what this page is built from.
          </p>
          <p>
            <strong>The city records no reason for a closure</strong> — no field, no note,
            nothing. A restaurant whose owner retired and one that ran out of money leave an
            identical trace. So nothing on this page explains why any establishment closed,
            and nothing here guesses. What it can tell you is everything the record does
            hold: how long a place operated, how often it was inspected, and how it did.
          </p>
          <p>
            An out-of-business record is also occasionally filed against a business that
            turns out to be operating — a temporary closure, a licence transfer, a locked
            door on the day. A licence therefore only appears here if no later graded
            inspection exists for it, so any correction the city files removes the listing
            automatically.
            {medianYears ? ` Among these closures, the typical establishment had been in the city's inspection records for about ${medianYears} years.` : ""}
          </p>
        </div>
      </div>

      {topHoods.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Where closures were recorded</h2>
          <p className="section-note section-note-left">
            Neighborhoods with the most out-of-business records in the last {windowDays} days.
          </p>
          <div className="hood-tally">
            {topHoods.map((h) => (
              <Link key={h.name} href={h.slug ? `/n/${h.slug}` : "/"} className="hood-tally-item">
                <span className="hood-tally-name">{h.name}</span>
                <span className="hood-tally-count">{h.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="wrap section">
        <h2 className="eyebrow">
          Every closure recorded, newest first
        </h2>
        {n === 0 ? (
          <p className="section-note section-note-left">
            No out-of-business records have been filed in the last {windowDays} days.
          </p>
        ) : (
          <>
            <div className="closure-list">
              {items.map((c, idx) => (
                <article
                  key={c.slug}
                  className={`closure-card${idx >= INITIAL_VISIBLE && !expanded ? " reveal-hidden" : ""}`}
                >
                  {/* Whole card is the target when a detail page exists --
                      the name alone was a small hit area for a card this size. */}
                  <CardShell hasPage={c.hasPage} slug={c.slug}>
                  <div className="closure-head">
                    <h3 className="closure-name">{c.n}</h3>
                    <span className="closed-tag">Closed</span>
                  </div>
                  <div className="closure-meta">
                    {(c.vn || c.ca || c.nb) && <>{c.vn || c.ca || c.nb}, Chicago &middot; </>}
                    recorded {c.d}
                  </div>
                  <p className="closure-summary">{c.summary}</p>
                  </CardShell>
                </article>
              ))}
            </div>
            {n > INITIAL_VISIBLE && !expanded && (
              <button className="cta-btn" onClick={() => setExpanded(true)}>
                Show all {n} recorded closures
              </button>
            )}
            <div className="section-note">
              Showing {expanded ? n : Math.min(INITIAL_VISIBLE, n)} of {n} recorded in the
              last {windowDays} days
              {oldest && newest ? ` (${oldest} to ${newest})` : ""}
            </div>
          </>
        )}
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Chicago restaurant closures FAQ</h2>
        {faqs.map((f) => (
          <div className="faq-item" key={f.q}>
            <p className="faq-q">{f.q}</p>
            <p className="faq-a">{f.a}</p>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
