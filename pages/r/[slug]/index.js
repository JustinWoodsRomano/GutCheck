import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
import { Nav, Footer } from "../../../components/Layout";
import Stamp from "../../../components/Stamp";
import RestaurantCard from "../../../components/RestaurantCard";
import HistoryAccordion from "../../../components/HistoryAccordion";
import { MapEmbed, ContactRow, RestaurantLogo } from "../../../components/Contact";
import AdSlot from "../../../components/AdSlot";
import { loadRestaurants, loadSlugIndex } from "../../../lib/data";
import { GRADE_LABEL } from "../../../lib/constants";
import { buildRestaurantFaq } from "../../../lib/restaurantCopy";
import { buildRestaurantFromRows, fetchRowsForRestaurant } from "../../../lib/inspections.mjs";
import { neighborhoodFor } from "../../../lib/zipNeighborhoods.mjs";
import { detectPests, inspectionReason, sortViolations } from "../../../lib/pests.mjs";

// getStaticProps now does a live, scoped Socrata call per restaurant (see
// below) instead of reading a pre-baked snapshot -- so pre-rendering all
// 8,000+ known slugs here would turn a single deploy into 8,000+
// sequential live API calls, the opposite of the efficiency this migration
// is for. Instead, paths starts empty and every restaurant page renders on
// its first visit via fallback: 'blocking', then serves from cache and
// revalidates hourly from then on. This is the standard ISR pattern for
// large catalogs: deploys stay fast no matter how many restaurants exist,
// and a page's data freshness is decoupled from needing a redeploy at all.
export async function getStaticPaths() {
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const slugIndex = loadSlugIndex();
  // Comes from the already-loaded lean index rather than loadRestaurants()
  // -- avoids reading the full (~26MB) dataset on every single restaurant
  // page request just to display a count.
  const total = Object.keys(slugIndex).length;
  const entry = slugIndex[params.slug];

  // Slug not in the last-built index -- brand-new restaurant, or requested
  // between builds. There's no known {name, address} yet to query Socrata
  // with, so this genuinely can't be resolved until the next full rebuild
  // picks it up. Retry sooner than the normal window in case the index
  // updates shortly.
  if (!entry) return { notFound: true, revalidate: 900 };

  let restaurant = null;
  try {
    const rows = await fetchRowsForRestaurant(entry.n, entry.a, entry.l);
    restaurant = buildRestaurantFromRows(rows, {
    neighborhoodFor,
    // Full record on a restaurant's own page: Infinity keeps every graded
    // inspection back to 2010 instead of the 5 the citywide build caps at.
    historyLimit: Infinity,
  });
  } catch (err) {
    console.error(`ISR revalidate fetch failed for ${params.slug}:`, err);
  }

  if (!restaurant) {
    // Scoped fetch failed (transient Socrata issue) or returned nothing
    // usable (e.g. the restaurant is now marked Out of Business) -- fall
    // back to the last full-build snapshot rather than taking the page
    // down, and retry the live fetch again soon.
    const fallback = loadRestaurants().find((r) => r.slug === params.slug);
    if (!fallback) return { notFound: true, revalidate: 300 };
    return { props: { restaurant: fallback, total }, revalidate: 300 };
  }

  // Belt-and-suspenders: the freshly-fetched restaurant's own computed slug
  // should always equal params.slug (both derive from the same name/license
  // identity), but if a business is ever renamed under the same license,
  // force it here anyway -- this page's canonical URL, OG image URL, and
  // breadcrumb links all key off restaurant.slug, and none of them should
  // ever point somewhere other than the URL actually being viewed.
  restaurant.slug = params.slug;

  // Neighbourhood shown here must match what the list views show. The live
  // Socrata fetch only yields the ZIP-derived neighbourhood, while every
  // list uses vernacular-first (vn -> ca -> nb). That mismatch was visible:
  // Roma's Kitchen reads "Bucktown" in a list and "Logan Square" here, off
  // the same record. The browse index holds the coordinate-derived
  // vernacular name, so adopt it -- it is both the more accurate label and
  // the one whose /n/ page actually lists this restaurant.
  const indexed = loadRestaurants().find((x) => x.slug === params.slug);
  if (indexed) {
    const label = indexed.vn || indexed.ca || indexed.nb;
    const labelSlug = indexed.vnSlug || indexed.caSlug || indexed.nbSlug;
    if (label && labelSlug) {
      restaurant.nb = label;
      restaurant.nbSlug = labelSlug;
    }
  }

  // Revalidate hourly: individual restaurant grade/violation changes go
  // live within an hour of appearing in the city's feed, without needing a
  // full site rebuild/redeploy.
  return { props: { restaurant, total, nearby: buildNearby(params.slug) }, revalidate: 3600 };
}

/**
 * Neighbours to link to from a restaurant page.
 *
 * This exists to fix a crawl problem as much as a UX one. Neighbourhood pages
 * server-render only their first 60 restaurants -- the rest arrive via a
 * client-side "Load more" -- so roughly 47% of restaurant pages had no
 * internal link pointing at them at all and were reachable only via the
 * sitemap. A sitemap declares that a URL exists; it passes no authority.
 *
 * Rather than every page linking to the same first few (which would deepen
 * the problem), each restaurant links to the ones that FOLLOW it in its own
 * neighbourhood, wrapping around at the end. Because the ordering is stable
 * and every restaurant is somebody's successor, this guarantees every page in
 * a neighbourhood is linked from at least one other page -- no orphans, and
 * link equity spreads around the ring instead of pooling.
 */
function buildNearby(slug, limit = 8) {
  const all = loadRestaurants();
  const self = all.find((x) => x.slug === slug);
  if (!self) return [];
  const key = (x) => x.vnSlug || x.caSlug || x.nbSlug || null;
  const hood = key(self);
  if (!hood) return [];

  const peers = all.filter((x) => key(x) === hood && x.slug !== slug);
  if (peers.length === 0) return [];

  const ordered = peers.slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const selfIdx = all
    .filter((x) => key(x) === hood)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .findIndex((x) => x.slug === slug);

  const out = [];
  for (let i = 0; i < Math.min(limit, ordered.length); i++) {
    out.push(ordered[(selfIdx + i) % ordered.length]);
  }
  // Shape matches what RestaurantCard reads, including the vn/ca/nb
  // priority it applies for the location line.
  return out.map((x) => ({
    slug: x.slug, n: x.n, g: x.g, d: x.d, it: x.it,
    nb: x.nb, vn: x.vn, ca: x.ca,
  }));
}

export default function RestaurantPage({ restaurant: r, total, nearby = [] }) {
  const gradeLabel = GRADE_LABEL[r.g];
  // Kept under ~60 chars so Google doesn't truncate it. The old format
  // ("... | GUTCHECK") averaged 72 and ran to 94, so the brand -- the part
  // most worth showing -- was the first thing cut. Long restaurant names
  // drop the neighbourhood rather than overflow.
  const baseTitle = `${r.n} Health Inspection`;
  const title =
    `${baseTitle} — ${r.nb}, Chicago`.length <= 60
      ? `${baseTitle} — ${r.nb}, Chicago`
      : `${baseTitle} — Chicago`.length <= 60
        ? `${baseTitle} — Chicago`
        : baseTitle;
  const description = `${r.n} in ${r.nb}, Chicago most recently ${gradeLabel === "Fail" ? "failed" : gradeLabel === "Pass" ? "passed" : "received a Pass w/ Conditions on"} its Chicago health inspection on ${r.d}. See full violation details and inspection history.`;
  const url = `https://www.gutcheckchicago.com/r/${r.slug}`;
  // Schema type inferred from the name, because the city's facility_type
  // isn't carried through to this page. Deliberately conservative: only
  // unambiguous drinking establishments get BarOrPub, everything else falls
  // back to Restaurant. A naive /bar|lounge/ test mislabelled 53 places --
  // "Kimberli Sushi Bar", "Hero Coffee Bar", "Protein Bar", "Lem's Bar-B-Q"
  // (the hyphen tokenises as a standalone "bar"). Validated against all
  // 8,153 names; yields 345 bars, under the ~600-700 bar licences known to
  // be in the dataset, which is the intended direction to err.
  const nm = r.n || "";
  const isBar =
    !/bar\s?-?\s?b\s?-?\s?q|barbecue|barbeque/i.test(nm) &&
    (/\b(tavern|saloon|taproom|tap\s?house|brew\s?pub|brewery|brewing|cocktail|ale\s?house|speakeasy|pub)\b/i.test(nm) ||
      (/\b(bar|lounge)\b/i.test(nm) &&
        !/\b(sushi|juice|coffee|salad|oyster|snack|candy|milk|taco|noodle|espresso|smoothie|raw|sandwich|pizza|burrito|poke|tea|dessert|donut|doughnut|bagel|cereal|yogurt|waffle|crepe|churro|hookah|nail|barber|protein|boba|bubble|acai|granola|energy|vitamin|nutrition|wellness|loaf|bakery|bread|soup|pasta|rice|bowl|water|oxygen|blow\s?dry|ice\s?cream|gelato|cake|chocolate|wing)\s+(bar|lounge)\b/i.test(nm)));

  const jsonLd = {
    "@context": "https://schema.org",
    // Restaurant is the specific subtype of LocalBusiness/FoodEstablishment.
    // Bars keep BarOrPub. The more specific type is what lets answer engines
    // treat these as food venues rather than generic businesses.
    "@type": isBar ? "BarOrPub" : "Restaurant",
    "@id": `${url}#business`,
    name: r.n,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: r.a,
      addressLocality: "Chicago",
      addressRegion: "IL",
      postalCode: r.z,
      addressCountry: "US",
    },
    ...(r.lat && r.lon ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lon } } : {}),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Most Recent Health Inspection Result",
        value: gradeLabel,
      },
      {
        "@type": "PropertyValue",
        name: "Most Recent Inspection Date",
        value: r.d,
      },
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GUTCHECK Chicago", item: "https://www.gutcheckchicago.com/" },
      { "@type": "ListItem", position: 2, name: r.nb, item: `https://www.gutcheckchicago.com/n/${r.nbSlug}` },
      { "@type": "ListItem", position: 3, name: r.n, item: url },
    ],
  };

  const faqItems = buildRestaurantFaq(r);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="restaurant" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`https://www.gutcheckchicago.com/og/${r.slug}.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="1200" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`https://www.gutcheckchicago.com/og/${r.slug}.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <div className="detail">
        <Link href="/" className="contact-chip back-btn">
          <ArrowLeft size={13} /> Back to results
        </Link>

        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", color: "var(--ink)", marginBottom: 20 }}>
          As of <strong>{r.d}</strong>, <strong>{r.n}</strong> {gradeLabel === "Fail" ? "failed" : gradeLabel === "Pass" ? "passed" : "received a Pass w/ Conditions on"} its most recent City of Chicago health inspection.
        </p>

        <div className="detail-head">
          <RestaurantLogo logoUrl={r.logoUrl} name={r.n} neighborhood={r.nb} grade={r.g} />
          <div className="detail-titles">
            <h1>{r.n}</h1>
          </div>
          <Stamp grade={r.g} size="lg" />
        </div>

        <div className="detail-sub">
          <MapPin size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
          {r.a}, Chicago, IL {r.z}
        </div>
        <div className="detail-sub2">
          <Link href={`/n/${r.nbSlug}`} style={{ textDecoration: "underline" }}>{r.nb}</Link> · Chicago Dept. of Public Health · Last inspected {r.d}
          {/* Sits inline with the date it describes. Complaint-driven visits
              fail at 34% against 22% for routine ones, so the trigger belongs
              next to the result, not on its own line below it. */}
          {inspectionReason(r.it) && (
            <>
              {" "}
              <span className={`reason-tag reason-${inspectionReason(r.it).tone}`}>
                {inspectionReason(r.it).label}
              </span>
            </>
          )}
        </div>

        <ContactRow
          address={`${r.a}, Chicago, IL ${r.z}`}
          phone={r.phone}
          website={r.website}
          restaurant={r}
          shareUrl={url}
        />

        <MapEmbed address={`${r.a}, Chicago, IL ${r.z}`} lat={r.lat} lon={r.lon} />

        <h2 className="eyebrow">Violations at most recent inspection</h2>
        <div style={{ marginBottom: 20 }}>
          {r.v.length === 0 && r.g === "PASS" && (
            <div style={{ fontFamily: "var(--font-serif)", color: "var(--seal-green)", fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} /> No violations recorded at last inspection.
            </div>
          )}
          {r.v.length === 0 && r.g !== "PASS" && (
            <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink-muted)", fontSize: "0.92rem", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                The City of Chicago&rsquo;s public record for this inspection lists a result of{" "}
                <strong>{r.g === "FAIL" ? "Fail" : "Pass w/ Conditions"}</strong> but doesn&rsquo;t include itemized
                violation text. GUTCHECK displays exactly what the city publishes and doesn&rsquo;t infer or add
                violation details that aren&rsquo;t in the official record.
              </span>
            </div>
          )}
          {sortViolations(r.v).map((v, i) => {
            const pests = detectPests(v.t);
            return (
              <div key={i} className={`violation ${v.s === "c" ? "critical" : "noncritical"}`}>
                <AlertTriangle size={16} color={v.s === "c" ? "var(--stamp-red)" : "var(--amber)"} style={{ flexShrink: 0, marginTop: 2 }} />
                <div className="violation-body">
                  {pests.length > 0 && (
                    <div className="pest-tags">
                      {pests.map((p) => (
                        <span key={p.key} className="pest-tag">
                          <span aria-hidden="true">{p.emoji}</span> {p.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="violation-text">{v.t}</div>
                  <div className="violation-sev">{v.s === "c" ? "priority violation" : "core violation"}</div>
                </div>
              </div>
            );
          })}
        </div>

        <AdSlot variant="banner" />

        {r.hi?.length > 0 && (
          <div style={{ margin: "26px 0 8px" }}>
            <h2 className="eyebrow">Inspection history — tap to expand</h2>
            <HistoryAccordion history={r.hi} />
          </div>
        )}

        <div style={{ margin: "26px 0 8px" }}>
          <h2 className="eyebrow">{r.n} health inspection FAQ</h2>
          {faqItems.map((f) => (
            <div className="faq-item" key={f.q}>
              <p className="faq-q">{f.q}</p>
              <p className="faq-a">{f.a}</p>
            </div>
          ))}
        </div>
        {nearby.length > 0 && (
          <div style={{ margin: "26px 0 8px" }}>
            <h2 className="eyebrow">
              Other restaurants &amp; bars in {r.nb}
            </h2>
            <div className="grid">
              {nearby.map((x) => (
                <RestaurantCard key={x.slug} r={x} source="restaurant-nearby" />
              ))}
            </div>
            <p className="section-note">
              <Link href={`/n/${r.nbSlug || ""}`}>
                See all {r.nb} restaurants &amp; bars
              </Link>
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
