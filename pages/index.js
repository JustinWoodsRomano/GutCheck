import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Search, LocateFixed, ArrowLeft, X } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import RestaurantCard from "../components/RestaurantCard";
import { isNewLicense } from "../lib/pests.mjs";
import AdSlot, { ADS_ENABLED } from "../components/AdSlot";
import { loadNeighborhoods, loadNeighborhoodStats, loadRestaurants } from "../lib/data";
import { COMING_SOON_AREAS } from "../lib/constants";

// Leaflet touches window/document directly, so it can only run client-side --
// dynamic-import with ssr disabled instead of a normal import.
const RestaurantMap = dynamic(() => import("../components/RestaurantMap"), { ssr: false });

const PAGE_SIZE = 60;
// Show fewer up front than we load per click: 60 cards is a wall on first
// paint, but once someone has chosen to load more they want a real batch.
const INITIAL_COUNT = 20;
const AD_EVERY = 12;

// Strips apostrophes (straight ' and curly ') before matching, so
// "McDonald's" and "Mcdonalds" return the same results regardless of
// which one the person typed or how the source name is punctuated.
function normalizeForSearch(s) {
  return (s || "").toLowerCase().replace(/['\u2019]/g, "");
}

// Single source of truth for what counts as a match, so the list view and
// the map view can't drift apart on what a given query means.
function matchesQuery(r, rawQuery) {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;
  const q = normalizeForSearch(trimmed);
  return (
    normalizeForSearch(r.n).includes(q) ||
    normalizeForSearch(r.nb).includes(q) ||
    r.z.includes(trimmed)
  );
}

// Haversine distance in miles -- used to scope the "near me" map to a
// walkable/lunch-break-relevant radius instead of dumping all 8,000+
// pins on screen at once.
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// How many chips show before "View all". Roughly five rows at desktop
// widths. Mobile ignores this entirely and renders the full list.
const COLLAPSED_CHIP_COUNT = 40;

export async function getStaticProps() {
  const neighborhoods = loadNeighborhoods();
  const stats = loadNeighborhoodStats();

  // Which neighborhoods survive the collapse: the ones with the most
  // places to look up. Restaurant count is a decent stand-in for how
  // often people want the page, and it stays correct on its own as the
  // data shifts, unlike a hand-kept list of "popular" names.
  const popularSlugs = neighborhoods
    .map((n) => ({ slug: n.slug, total: stats.byNeighborhood?.[n.slug]?.total || 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, COLLAPSED_CHIP_COUNT)
    .map((n) => n.slug);

  return {
    props: {
      // Render order stays alphabetical. Expanding fills the gaps between
      // the chips already on screen instead of appending a second block,
      // so nothing jumps position.
      neighborhoods,
      popularSlugs,
      citywideTopViolations: stats.citywideTopViolations || [],
      citywideWithViolations: stats.citywideWithViolations || 0,
      // Server-rendered so there is real content here without JavaScript.
      // The main restaurant list is built client-side from restaurants.json,
      // which Googlebot renders but GPTBot, ClaudeBot and PerplexityBot do
      // not -- to them the homepage was a search box and a list of
      // neighbourhood names, with zero restaurants on the site's highest-
      // authority page. These 24 are in the HTML for every crawler.
      recentlyInspected: buildRecentlyInspected(24),
    },
  };
}

// Most recently inspected places, newest first, one per neighbourhood where
// possible so the block reads as a spread across the city rather than
// whichever neighbourhood happened to be inspected that week.
function buildRecentlyInspected(limit) {
  const all = loadRestaurants();
  const sorted = all
    .filter((r) => r.d && r.n)
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  const seen = new Set();
  const out = [];
  for (const r of sorted) {
    const hood = r.vnSlug || r.caSlug || r.nbSlug || "";
    if (seen.has(hood)) continue;
    seen.add(hood);
    out.push({ slug: r.slug, n: r.n, g: r.g, d: r.d, it: r.it, nb: r.nb, vn: r.vn, ca: r.ca });
    if (out.length >= limit) break;
  }
  // Top up from the plain recency list if there weren't enough neighbourhoods.
  for (const r of sorted) {
    if (out.length >= limit) break;
    if (out.some((x) => x.slug === r.slug)) continue;
    out.push({ slug: r.slug, n: r.n, g: r.g, d: r.d, it: r.it, nb: r.nb, vn: r.vn, ca: r.ca });
  }
  return out;
}

export default function Home({ neighborhoods, popularSlugs, citywideTopViolations, citywideWithViolations, recentlyInspected = [] }) {
  const [data, setData] = useState(null);
  const [showAllNeighborhoods, setShowAllNeighborhoods] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [loadError, setLoadError] = useState(false);
  const [mapCenter, setMapCenter] = useState(null); // { lat, lng, isUser } or null (list view)
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | requesting | denied | error
  const [mapQuery, setMapQuery] = useState(""); // debounced copy of `query`; drives the map

  useEffect(() => {
    let cancelled = false;

    // A couple of quick automatic retries for genuine transient network
    // blips (dropped mobile connection mid-request, brief edge hiccup) --
    // cheap defense in depth now that the payload itself is small (~800KB,
    // down from a 26.6MB file that used to carry every restaurant's full
    // violation history and inspection history even though this page never
    // reads either field).
    async function loadWithRetry(attempt = 0) {
      try {
        const r = await fetch("/data/restaurants.json");
        if (!r.ok) throw new Error(`bad response: ${r.status}`);
        const json = await r.json();
        if (!cancelled) setData(json.sort((a, b) => (a.d < b.d ? 1 : -1)));
      } catch (err) {
        if (cancelled) return;
        if (attempt < 2) {
          setTimeout(() => loadWithRetry(attempt + 1), 600 * (attempt + 1));
        } else {
          setLoadError(true);
          setData([]);
        }
      }
    }

    loadWithRetry();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (query.trim()) list = list.filter((r) => matchesQuery(r, query));
    return list;
  }, [data, query]);

  // Restaurants within a lunch-break-relevant radius of the user, falling
  // back to the full dataset if fewer than 5 are within range (edge case
  // near city limits) so the map is never near-empty.
  const nearbyRestaurants = useMemo(() => {
    if (!data || !mapCenter) return [];
    const withDistance = data
      .filter((r) => r.lat != null && r.lon != null)
      .map((r) => ({ ...r, _dist: distanceMiles(mapCenter.lat, mapCenter.lng, r.lat, r.lon) }));
    const nearby = withDistance.filter((r) => r._dist <= 3);
    return nearby.length >= 5 ? nearby : withDistance;
  }, [data, mapCenter]);

  // The list re-filters instantly on every keystroke, but the map also
  // redraws pins and re-fits its bounds -- doing that mid-word is jumpy,
  // so the map waits for a brief pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setMapQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const mapSearchActive = mapQuery.trim().length > 0;

  // What the map actually plots. With a search active this deliberately
  // drops the 3-mile cutoff and searches the whole city -- looking a place
  // up by name should find it, not report nothing nearby. Nearest first.
  const mapRestaurants = useMemo(() => {
    if (!data || !mapCenter) return [];
    if (!mapSearchActive) return nearbyRestaurants;
    return data
      .filter((r) => r.lat != null && r.lon != null && matchesQuery(r, mapQuery))
      .map((r) => ({ ...r, _dist: distanceMiles(mapCenter.lat, mapCenter.lng, r.lat, r.lon) }))
      .sort((a, b) => a._dist - b._dist);
  }, [data, mapCenter, mapQuery, mapSearchActive, nearbyRestaurants]);

  function handleNearMe() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus("idle");
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, isUser: true });
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "near_me_search");
        }
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // GA4 search event, debounced 800ms after typing stops -- fires once
  // per pause in typing rather than on every keystroke, so this captures
  // what people actually searched for instead of every partial letter.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "search", { search_term: trimmed });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [query]);

  const total = data ? data.length : 0;
  const visible = filtered.slice(0, visibleCount);

  // Restaurants whose latest inspection was a licence check. These are
  // genuinely new openings rather than a random sample, and their thin
  // inspection history is worth explaining rather than leaving to look
  // suspicious.
  const newlyLicensed = useMemo(() => {
    if (!data) return [];
    // Same 90-day definition of "new" the rest of the site uses.
    return data
      .filter((r) => isNewLicense(r.it, r.d))
      .sort((a, b) => (a.d < b.d ? 1 : -1))
      .slice(0, 8);
  }, [data]);

  const title = "Chicago Restaurant & Bar Health Inspections — GutCheck";
  const description =
    "Look up any Chicago restaurant or bar's official health inspection status — pass, fail, or violations — sourced live from the City of Chicago. Free, updated daily.";

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://www.gutcheckchicago.com/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.gutcheckchicago.com/og/default.webp" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://www.gutcheckchicago.com/#website",
                  name: "GutCheck Chicago",
                  url: "https://www.gutcheckchicago.com/",
                  publisher: { "@id": "https://www.gutcheckchicago.com/#org" },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://www.gutcheckchicago.com/?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  // Named publisher entity. Answer engines weigh who is behind
                  // a claim when deciding whether to cite it; a WebSite alone
                  // says nothing about who is making the claim.
                  "@type": "Organization",
                  "@id": "https://www.gutcheckchicago.com/#org",
                  name: "GutCheck Chicago",
                  url: "https://www.gutcheckchicago.com/",
                  email: "GutCheckChicago@builtbybackspace.com",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://www.gutcheckchicago.com/gutcheck-mark.png",
                  },
                  description:
                    "Independent service publishing City of Chicago restaurant and bar health inspection records in a searchable format. Not affiliated with the City of Chicago.",
                  areaServed: { "@type": "City", name: "Chicago", sameAs: "https://en.wikipedia.org/wiki/Chicago" },
                  parentOrganization: { "@type": "Organization", name: "Built by Backspace" },
                },
              ],
            }),
          }}
        />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <div className="eyebrow">Health inspection records · official public data</div>
        <h1>
          KNOW BEFORE
          <br />
          YOU EAT.
        </h1>
        <p>
          Search official Chicago restaurant and bar health inspection records — pass/fail
          results, violations, and full history, straight from the city&rsquo;s own data.
        </p>
        {/* The chip block below runs to 113 links. This is the skip that
            actually saves keyboard users the tab-through. */}
        <a href="#results" className="skip-link skip-link-inline">Skip to results</a>
        <div className="search-bar">
          <Search size={18} color="var(--ink-muted)" aria-hidden="true" />
          {/* A placeholder is not a label: it is unreadable to a screen
              reader and disappears the moment someone types. This is the
              primary interaction on the site, so it gets a real label --
              visually hidden, since the placeholder already carries the
              hint sighted users need. */}
          <label htmlFor="site-search" className="sr-only">
            Search Chicago restaurants and bars by name, neighborhood, or ZIP code
          </label>
          <input
            id="site-search"
            /* type=search gives iOS/Android the Search key and a native
               clear affordance; autocorrect and capitalisation fight
               restaurant names, so both are off. */
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Chicago restaurant or bar, neighborhood, or ZIP code…"
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        {!mapCenter && (
          <>
            <button className="near-me-btn" onClick={handleNearMe} disabled={geoStatus === "requesting"}>
              <LocateFixed size={18} />
              {geoStatus === "requesting" ? "Finding you…" : "What’s near me right now"}
            </button>
            {geoStatus === "denied" && (
              <p className="geo-error">
                Location access is off. Enable it in your browser settings to see what&rsquo;s nearby.
              </p>
            )}
            {geoStatus === "error" && (
              <p className="geo-error">Couldn&rsquo;t get your location. Try again in a moment.</p>
            )}
          </>
        )}
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />

        {mapCenter ? (
          <>
            <div className="map-header">
              <button className="back-to-list" onClick={() => setMapCenter(null)}>
                <ArrowLeft size={16} /> Back to list
              </button>
              <span className="map-count">
                {mapSearchActive
                  ? `${mapRestaurants.length} result${mapRestaurants.length === 1 ? "" : "s"}`
                  : `${nearbyRestaurants.length} nearby`}
              </span>
            </div>
            {mapSearchActive && mapRestaurants.length === 0 && (
              <div className="map-empty-notice">
                Nothing on file matching &ldquo;{mapQuery.trim()}&rdquo;. Clear the search to go back to
                what&rsquo;s near you.
              </div>
            )}
            <RestaurantMap
              restaurants={mapRestaurants}
              center={mapCenter}
              zoom={nearbyRestaurants.length === data?.length ? 12 : 15}
              fitToMarkers={mapSearchActive && mapRestaurants.length > 0}
            />
          </>
        ) : (
          <>
            <h2 className="eyebrow" style={{ marginTop: 22 }}>
              {query.trim() ? `Results for "${query}"` : "All Chicago restaurants & bars"}
            </h2>

            {/* These are links, not filters. As filters they matched on
                nbSlug only, so every community-area chip (Avondale, West
                Town, Bridgeport...) selected zero restaurants and showed
                "Nothing on file". The neighborhood pages do this properly --
                scoped search, stats, FAQ -- and linking out also gives
                crawlers 91 internal paths straight off the homepage. */}
            {/* Hidden entirely while a search is active. The chips are
                links to neighborhood pages, not filters, so leaving them
                under "Results for X" reads as though they're part of the
                result set. Returns on its own when the box is cleared. */}
            {!query.trim() && (
              <>
            {/* Every chip is always in the DOM so crawlers see all 113
                internal links and mobile is untouched. The collapse is
                purely a desktop CSS concern -- see .chip-row-collapsed. */}
            <div className={`chip-row${showAllNeighborhoods ? "" : " chip-row-collapsed"}`}>
              {neighborhoods.map((n) => (
                <Link
                  key={n.slug}
                  href={`/n/${n.slug}`}
                  className={`chip${popularSlugs.includes(n.slug) ? "" : " chip-extra"}`}
                >
                  {n.name}
                </Link>
              ))}
              {COMING_SOON_AREAS.map((name) => (
                <span
                  key={name}
                  className="chip coming-soon chip-extra"
                  title="Coming soon — no verified public data source yet"
                >
                  {name} (soon)
                </span>
              ))}
            </div>

            <button
              type="button"
              className="chip-toggle"
              onClick={() => setShowAllNeighborhoods((v) => !v)}
              aria-expanded={showAllNeighborhoods}
            >
              {showAllNeighborhoods
                ? "Show fewer neighborhoods"
                : `View all ${neighborhoods.length} neighborhoods`}
            </button>
              </>
            )}

            {!data && !loadError && <div className="loading">Loading Chicago&rsquo;s inspection records…</div>}
            {loadError && data?.length === 0 && (
              <div className="empty">Couldn&rsquo;t reach the inspection data feed right now. Try refreshing.</div>
            )}

            {data && filtered.length === 0 && (
              <div className="empty">Nothing on file for that search. Try a different name, neighborhood, or ZIP.</div>
            )}

            {data && filtered.length > 0 && (
              <>
                <div className="grid" id="results">
                  {visible.map((r, i) => (
                    <div key={r.id} style={{ display: "contents" }}>
                      <RestaurantCard r={r} source="homepage" />
                      {(i + 1) % AD_EVERY === 0 && ADS_ENABLED && (
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
                <div className="section-note">
                  Showing {visible.length.toLocaleString()} of{" "}
                  {filtered.length.toLocaleString()}
                  {query.trim() ? " matching" : ""} Chicago restaurants &amp; bars
                </div>
              </>
            )}
          </>
        )}
      </div>

      {!query.trim() && newlyLicensed.length > 0 && (
        <div className="wrap section">
          <div className="section-head">
            <h2 className="eyebrow">
              <span className="word-new">NEW</span> restaurants &amp; bars
            </h2>
            <span className="reason-tag reason-new section-head-badge">New license</span>
          </div>
          <p className="new-intro">
            Places whose most recent inspection was a licensing check &mdash; typically a new or
            renewed food licence, often before opening. A short record here means the business is
            new, not that it has been avoiding inspectors.
          </p>
          <div className="grid">
            {newlyLicensed.map((r) => (
              <RestaurantCard key={r.id} r={r} source="homepage-new" showReason />
            ))}
          </div>
          <Link href="/new-restaurants" className="cta-btn">
            View all new Chicago restaurants &amp; bars
          </Link>
        </div>
      )}

      {/* Server-rendered, and deliberately NOT gated on the client-side
          `data` load -- this is the block that gives a non-JS crawler
          something to read. It stays out of the way during an active search. */}
      {!query.trim() && recentlyInspected.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Recently inspected across Chicago</h2>
          <p className="section-note section-note-left">
            The latest health inspection results filed by the Chicago Department of
            Public Health, one per neighborhood.
          </p>
          <div className="grid">
            {recentlyInspected.map((x) => (
              <RestaurantCard key={x.slug} r={x} source="homepage-recent" />
            ))}
          </div>
        </div>
      )}

      {citywideTopViolations.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Chicago&rsquo;s most-cited health violations</h2>
          <p className="viol-intro">
            Across {citywideWithViolations.toLocaleString()} Chicago restaurants and bars carrying any
            violation on their latest inspection. Frequency is not severity &mdash; the most-written-up
            item is one of the least predictive of an actual failure, which we{" "}
            <Link href="/data">analyzed across 184,618 inspections</Link>.
          </p>
          <ol className="viol-list">
            {citywideTopViolations.map((v) => (
              <li key={v.code}>
                {/* Only #55 has a resource page so far; the rest stay plain
                    text until theirs exist rather than linking nowhere. */}
                {v.code === 55 ? (
                  <Link href="/violations/physical-facilities" className="viol-title viol-title-link">
                    {v.title}
                  </Link>
                ) : (
                  <span className="viol-title">{v.title}</span>
                )}
                <span className="viol-meta">
                  cited at {v.count.toLocaleString()} places · {v.share}% of those with violations
                </span>
              </li>
            ))}
          </ol>
          <Link href="/data" className="cta-btn">
            See the full inspection data analysis
          </Link>
        </div>
      )}

      <Footer />
    </div>
  );
}
