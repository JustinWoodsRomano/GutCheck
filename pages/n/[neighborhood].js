import { useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { Search, X, ChevronRight } from "lucide-react";
import { GRADE_EMOJI } from "../../lib/constants";
import { Nav, Footer } from "../../components/Layout";
import RestaurantCard from "../../components/RestaurantCard";
import AdSlot, { ADS_ENABLED } from "../../components/AdSlot";
import {
  loadRestaurants,
  loadNeighborhoods,
  loadNeighborhoodStats,
  loadNeighborhoodMeta,
} from "../../lib/data";
import { buildNeighborhoodIntro, buildNeighborhoodFaqCopy } from "../../lib/neighborhoodCopy";

const SITE = "https://www.gutcheckchicago.com";
const PAGE_SIZE = 60;
const GRADE_LABEL_SHORT = { PASS: "passing", CONDITIONAL: "passed with conditions", FAIL: "failing" };

export async function getStaticPaths() {
  const neighborhoods = loadNeighborhoods();
  return {
    paths: neighborhoods.map((n) => ({ params: { neighborhood: n.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  // Archived closures share this file now. A neighbourhood page is a list of
  // places to eat, so they are excluded here; they stay reachable by search
  // and from /closed-restaurants.
  const all = loadRestaurants().filter((r) => !r.closed);
  const meta = loadNeighborhoodMeta()[params.neighborhood] || null;

  // A restaurant belongs to this page if EITHER its vernacular neighborhood
  // or its official community area matches. Wicker Park sits inside West
  // Town, so a Wicker Park restaurant legitimately appears on both.
  // Match on any geography this restaurant belongs to: legacy ZIP
  // neighborhood, official community area, coordinate-derived vernacular
  // neighborhood, or a legacy alias (Pilsen, Bronzeville, South Loop...).
  const matches = all.filter(
    (r) =>
      r.nbSlug === params.neighborhood ||
      r.caSlug === params.neighborhood ||
      r.vnSlug === params.neighborhood ||
      (r.aliasSlugs || []).includes(params.neighborhood)
  );
  if (matches.length === 0) return { notFound: true };

  const name = meta?.name || matches[0].nb;
  const passCount = matches.filter((r) => r.g === "PASS").length;
  const conditionalCount = matches.filter((r) => r.g === "CONDITIONAL").length;
  const failCount = matches.filter((r) => r.g === "FAIL").length;
  const stats = loadNeighborhoodStats().byNeighborhood[params.neighborhood] || null;

  // Vernacular sub-neighborhoods that fall inside this community area --
  // used for internal linking and to name-drop the terms people search.
  const relatedSlugs = [
    ...new Set(
      matches
        .map((r) => r.vnSlug || r.nbSlug)
        .filter((s) => s && s !== params.neighborhood)
    ),
  ];
  const allMeta = loadNeighborhoodMeta();
  const related = relatedSlugs
    .map((s) => ({ slug: s, name: allMeta[s]?.name || s }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 12);

  const restaurants = matches
    // vn/ca must survive the trim -- RestaurantCard prefers the
    // coordinate-derived names, and without them every card silently fell
    // back to the stale ZIP-derived neighborhood (Bucktown listings were
    // labelled "Logan Square").
    // `it` carries the inspection reason, which RestaurantCard needs to flag
    // recently licensed places. Dropping it here silently suppressed the
    // "New license" badge on every neighbourhood page.
    .map((r) => ({ id: r.id, slug: r.slug, n: r.n, nb: r.nb, vn: r.vn, ca: r.ca, g: r.g, d: r.d, it: r.it }))
    .sort((a, b) => (a.d < b.d ? 1 : -1));

  return {
    props: {
      restaurants,
      name,
      slug: params.neighborhood,
      total: all.length,
      passCount,
      conditionalCount,
      failCount,
      stats,
      related,
      officialName: meta?.officialName || null,
      kind: meta?.kind || "vernacular",
    },
  };
}

export default function NeighborhoodPage({
  restaurants,
  name,
  slug,
  total,
  passCount,
  conditionalCount,
  failCount,
  stats,
  related,
  officialName,
  kind,
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState(null); // null | PASS | CONDITIONAL | FAIL
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = restaurants;
    if (grade) list = list.filter((r) => r.g === grade);
    const q = query.trim().toLowerCase().replace(/['\u2019]/g, "");
    if (q) list = list.filter((r) => r.n.toLowerCase().replace(/['\u2019]/g, "").includes(q));
    return list;
  }, [query, grade, restaurants]);

  function toggleGrade(g) {
    setGrade((cur) => (cur === g ? null : g));
    setVisibleCount(PAGE_SIZE);
  }

  const visible = filtered.slice(0, visibleCount);

  // Title/description lead with how people actually search -- "<name>
  // restaurants" -- rather than the inspection framing, which has
  // effectively no search volume of its own.
  const title = `${name} Restaurants & Bars — Health Inspection Records | GUTCHECK Chicago`;
  const description = `${restaurants.length} restaurants and bars in ${name}, Chicago. See which passed their latest health inspection — ${passCount} passing, ${conditionalCount} passed with conditions, ${failCount} failing. Official city data, updated daily.`;
  const url = `${SITE}/n/${slug}`;
  const intro = buildNeighborhoodIntro({ name, stats });
  const faqItems = buildNeighborhoodFaqCopy({ name, stats });

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Restaurants and bars in ${name}, Chicago`,
    numberOfItems: restaurants.length,
    itemListElement: restaurants.slice(0, 100).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/r/${r.slug}`,
      name: r.n,
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GUTCHECK Chicago", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Chicago neighborhoods", item: `${SITE}/#neighborhoods` },
      { "@type": "ListItem", position: 3, name, item: url },
    ],
  };

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
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og/default.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">GUTCHECK Chicago</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">{name}</span>
      </nav>

      <div className="wrap hero">
        <div className="eyebrow">
          Chicago · {restaurants.length} restaurants &amp; bars · official inspection data
        </div>
        <h1 className="nb-title">
          <span className="nb-brand">GUTCHECK</span>
          <span className="nb-place">{name.toUpperCase()}</span>
        </h1>
        <p>{intro}</p>

        <div className="search-bar">
          <Search size={18} color="var(--ink-muted)" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder={`Search ${name} restaurants and bars\u2026`}
            aria-label={`Search restaurants and bars in ${name}`}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Clickable grade filters. Same emoji + tint tokens as the Stamp
            component so a filter chip reads as the same object as the badge
            on each card. */}
        <div className="nb-stats" role="group" aria-label={`Filter ${name} restaurants by inspection result`}>
          <button
            type="button"
            className={`nb-stat pass ${grade === "PASS" ? "is-active" : ""}`}
            onClick={() => toggleGrade("PASS")}
            aria-pressed={grade === "PASS"}
          >
            <span className="nb-stat-emoji">{GRADE_EMOJI.PASS}</span> {passCount} passing
          </button>
          <button
            type="button"
            className={`nb-stat cond ${grade === "CONDITIONAL" ? "is-active" : ""}`}
            onClick={() => toggleGrade("CONDITIONAL")}
            aria-pressed={grade === "CONDITIONAL"}
          >
            <span className="nb-stat-emoji">{GRADE_EMOJI.CONDITIONAL}</span> {conditionalCount} w/ conditions
          </button>
          <button
            type="button"
            className={`nb-stat fail ${grade === "FAIL" ? "is-active" : ""}`}
            onClick={() => toggleGrade("FAIL")}
            aria-pressed={grade === "FAIL"}
          >
            <span className="nb-stat-emoji">{GRADE_EMOJI.FAIL}</span> {failCount} failing
          </button>
          {grade && (
            <button type="button" className="nb-stat-clear" onClick={() => setGrade(null)}>
              Clear filter
            </button>
          )}
        </div>
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />

        <h2 className="eyebrow" style={{ marginTop: 22 }}>
          {query.trim() || grade
            ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} in ${name}` +
              (grade ? ` \u00b7 ${GRADE_LABEL_SHORT[grade]}` : "")
            : `All ${name} restaurants & bars`}
        </h2>

        {filtered.length === 0 && (
          <div className="empty">
            {query.trim()
              ? `Nothing in ${name} matching \u201c${query.trim()}\u201d.`
              : `No ${name} restaurants currently have that inspection result.`}
          </div>
        )}

        <div className="grid">
          {visible.map((r, i) => (
            <div key={r.id} style={{ display: "contents" }}>
              <RestaurantCard r={r} source="neighborhood" />
              {(i + 1) % 12 === 0 && ADS_ENABLED && (
                <div className="grid-ad">
                  <AdSlot variant="infeed" />
                </div>
              )}
            </div>
          ))}
        </div>

        {visibleCount < filtered.length && (
          <button className="load-more" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </button>
        )}
      </div>

      {stats?.topViolations?.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Most-cited violations in {name}</h2>
          <p className="viol-intro">
            Across {name} establishments with any violation on their latest inspection, these come up
            most often. Citation frequency isn&rsquo;t the same as severity &mdash; see{" "}
            <Link href="/data">our analysis of which violations actually predict a failure</Link>.
          </p>
          <ol className="viol-list">
            {stats.topViolations.map((v) => (
              <li key={v.code}>
                <span className="viol-title">{v.title}</span>
                <span className="viol-meta">
                  cited at {v.count} {v.count === 1 ? "place" : "places"} · {v.share}% of those with
                  violations
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {related.length > 0 && (
        <div className="wrap section">
          {/* Deliberately "nearby", not "in". These are derived from
              restaurants whose coordinates fall inside this area but whose
              vernacular (ZIP-derived) neighborhood differs -- real overlap
              at the edges, not containment. Labeling Logan Square as being
              "in Avondale" would simply be wrong. */}
          <h2 className="eyebrow">Nearby Chicago neighborhoods</h2>
          <div className="chip-row">
            {related.map((n) => (
              <Link key={n.slug} href={`/n/${n.slug}`} className="chip">
                {n.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="wrap section">
        <h2 className="eyebrow">{name} health inspection FAQ</h2>
        <div>
          {faqItems.map((f) => (
            <div className="faq-item" key={f.q}>
              <p className="faq-q">{f.q}</p>
              <p className="faq-a">{f.a}</p>
            </div>
          ))}
        </div>
        {officialName && officialName !== name && (
          <p className="hint">
            {name} sits within the {officialName} community area as defined by the City of Chicago.
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
}
