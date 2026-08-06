import Head from "next/head";
import Link from "next/link";
import { Nav, Footer } from "../components/Layout";
import RestaurantCard from "../components/RestaurantCard";
import { useState } from "react";
import { loadRestaurants, loadSlugIndex } from "../lib/data";

const SITE = "https://www.gutcheckchicago.com";

// Shared with the badge that appears on every listing sitewide, so "new"
// means the same thing on this page as it does on a card anywhere else.
import { NEW_LICENCE_DAYS } from "../lib/pests.mjs";

const WINDOW_DAYS = NEW_LICENCE_DAYS;

// How many are visible before the reader asks for more. The rest are still
// in the HTML -- hidden with CSS, not withheld from the markup -- so every
// listing keeps its crawlable internal link.
const INITIAL_VISIBLE = 20;

/**
 * New Chicago restaurants and bars, defined as: most recent inspection was a
 * licence inspection, filed within the last 60 days.
 *
 * Search positioning matters here. "new restaurants chicago" (2,400/mo) is
 * owned end to end by editorial round-ups -- Chicago Magazine, Eater,
 * Infatuation, Reddit, Resy -- all answering "which new restaurants are
 * GOOD". GUTCHECK has no reviews and would lose that fight on merit.
 *
 * What nobody on that SERP answers is "which places just got licensed, and
 * did they pass". That is a different question, this is the only public
 * source that can answer it, and the copy below leans into that distinction
 * rather than pretending to be another best-of list.
 */
export async function getStaticProps() {
  const all = loadRestaurants();
  const total = Object.keys(loadSlugIndex()).length;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const items = all
    .filter((r) => r.it === "License" && r.n && r.d && r.d >= cutoffStr)
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0))
    .map((r) => ({
      slug: r.slug, n: r.n, g: r.g, d: r.d, it: r.it,
      nb: r.nb, vn: r.vn, ca: r.ca,
      nbSlug: r.vnSlug || r.caSlug || r.nbSlug,
    }));

  const byHood = {};
  for (const i of items) {
    const name = i.vn || i.ca || i.nb;
    if (!name) continue;
    if (!byHood[name]) byHood[name] = { name, count: 0, slug: i.nbSlug };
    byHood[name].count += 1;
  }
  const topHoods = Object.values(byHood).sort((a, b) => b.count - a.count).slice(0, 8);

  const counts = items.reduce((a, i) => ({ ...a, [i.g]: (a[i.g] || 0) + 1 }), {});

  return {
    props: {
      items, total, topHoods, counts,
      newest: items[0]?.d || null,
      oldest: items[items.length - 1]?.d || null,
      windowDays: WINDOW_DAYS,
    },
    revalidate: 3600,
  };
}

export default function NewRestaurants({
  items, total, topHoods, counts, newest, oldest, windowDays,
}) {
  const [expanded, setExpanded] = useState(false);
  const n = items.length;
  const passRate = n ? Math.round(((counts.PASS || 0) / n) * 100) : 0;

  // Leads with "New Chicago Restaurants" -- targets "new chicago
  // restaurants" (590/mo, KD 20) and "chicago new restaurants" (480/mo,
  // KD 25), both winnable, rather than "best new restaurants chicago",
  // which is an editorial SERP this page has no business entering.
  const title = "New Chicago Restaurants & Bars — Just Licensed";
  const description = `${n} Chicago restaurants and bars licensed in the last ${windowDays} days, with the health inspection result for each. Sourced from the City of Chicago's official food inspection records.`;
  const url = `${SITE}/new-restaurants`;

  const faqs = [
    {
      q: "How do you know which Chicago restaurants are new?",
      a: `The City of Chicago records why every inspection happened. When the reason is a licence inspection, the business is applying for a new food licence or renewing one — normally before it serves a single customer. This page lists every Chicago restaurant and bar whose most recent inspection was a licence inspection filed in the last ${windowDays} days. Chicago publishes no opening-date field, so this is the closest signal the public record offers to a new opening.`,
    },
    {
      q: "Is this a list of the best new restaurants in Chicago?",
      a: "No. This is a record of which establishments were recently licensed and how they did on inspection. It contains no reviews, ratings or recommendations. For opinions on which new restaurants are worth visiting, publications like Chicago Magazine, Eater Chicago and The Infatuation cover that; this page answers a different question — what just opened, and did it pass.",
    },
    {
      q: "Does a licence inspection mean the restaurant has opened?",
      a: "Not necessarily. A licence inspection usually happens shortly before opening, so a business appearing here is typically days or weeks from serving customers, and occasionally already open. It is a signal that a business is about to begin operating, not a confirmed opening date.",
    },
    {
      q: "Can a brand-new Chicago restaurant fail its first inspection?",
      a: `Yes. Licence inspections are real inspections and can result in a Fail or a Pass with Conditions — most often for equipment, plumbing or facility problems found before opening. Of the ${n} recently licensed places on this page, ${counts.PASS || 0} passed, ${counts.CONDITIONAL || 0} passed with conditions and ${counts.FAIL || 0} failed. An establishment that fails is re-inspected and must pass before it can operate.`,
    },
    {
      q: "Does a short inspection history mean a restaurant is unsafe?",
      a: "No. A new business simply has not been inspected many times yet. A short record here means the establishment is recent — not that it has been avoiding inspectors.",
    },
    {
      q: "How often does this list update?",
      a: `It rebuilds from the City of Chicago's Food Inspections feed, which the city updates on an ongoing basis.${newest ? ` The most recent licence inspection listed is dated ${newest}.` : ""}`,
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
        about: {
          "@type": "Thing",
          name: "New Chicago restaurant and bar openings",
          description: "Chicago restaurants and bars that recently received or renewed a food licence, with their health inspection results.",
        },
        spatialCoverage: { "@type": "City", name: "Chicago", sameAs: "https://en.wikipedia.org/wiki/Chicago" },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: `New Chicago restaurants and bars licensed in the last ${windowDays} days`,
        numberOfItems: n,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: items.slice(0, 100).map((i, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${SITE}/r/${i.slug}`,
          name: i.n,
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
          { "@type": "ListItem", position: 2, name: "New restaurants & bars", item: url },
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
        <div className="eyebrow">Recently licensed &middot; official public data</div>
        <h1>NEW RESTAURANTS &amp; BARS.</h1>

        {/* Answer-first sentence: the question, resolved, in one liftable
            statement with the number and the timeframe both in it. */}
        <p className="lede">
          {n} Chicago restaurants and bars have been licensed in the last {windowDays} days.
          Each one is listed below with the result of the health inspection the city
          carried out before it opened — {counts.PASS || 0} passed,{" "}
          {counts.CONDITIONAL || 0} passed with conditions and {counts.FAIL || 0} failed.
        </p>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">What counts as a new restaurant here</h2>
        <div className="prose">
          <p>
            Chicago does not publish a restaurant opening date. What it does publish is the
            reason for every health inspection — and when that reason is a{" "}
            <strong>licence inspection</strong>, the business is applying for a new food
            licence or renewing one, almost always before it serves a customer. That makes a
            licence inspection the closest thing the public record has to an opening
            announcement.
          </p>
          <p>
            This page lists every Chicago restaurant and bar whose most recent inspection was
            a licence inspection filed within the last {windowDays} days
            {oldest && newest ? ` — currently ${oldest} through ${newest}` : ""}. It is not a
            best-of list and contains no reviews. It answers a narrower question that no
            restaurant guide answers: <strong>what just opened, and did it pass?</strong>
          </p>
          <p>
            {passRate}% of these recently licensed establishments passed outright. A short
            inspection record here means a business is new, not that it has been avoiding
            inspectors — and a first-inspection failure is usually an equipment or plumbing
            problem caught before opening, not a reason to write a place off.
          </p>
        </div>
      </div>

      {topHoods.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Where Chicago is opening right now</h2>
          <p className="section-note section-note-left">
            Neighborhoods with the most newly licensed restaurants and bars in the last{" "}
            {windowDays} days.
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
        <h2 className="eyebrow">Every newly licensed restaurant &amp; bar, newest first</h2>
        {n === 0 ? (
          <p className="section-note section-note-left">
            No licence inspections have been filed in the last {windowDays} days. This is
            unusual and normally means the city&rsquo;s feed is between updates — check back
            shortly.
          </p>
        ) : (
          <>
            <div className="grid">
              {items.map((i, idx) => (
                <div
                  key={i.slug}
                  className={idx >= INITIAL_VISIBLE && !expanded ? "reveal-hidden" : undefined}
                >
                  <RestaurantCard r={i} source="new-restaurants" />
                </div>
              ))}
            </div>
            {items.length > INITIAL_VISIBLE && !expanded && (
              <button className="cta-btn" onClick={() => setExpanded(true)}>
                Show all {items.length} newly licensed restaurants &amp; bars
              </button>
            )}
            <div className="section-note">
              Showing {expanded ? items.length : Math.min(INITIAL_VISIBLE, items.length)} of{" "}
              {items.length} licensed in the last {windowDays} days
            </div>
          </>
        )}
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">New Chicago restaurant inspections FAQ</h2>
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
