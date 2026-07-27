import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { Search, LocateFixed, ArrowLeft, X } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import RestaurantCard from "../components/RestaurantCard";
import AdSlot, { ADS_ENABLED } from "../components/AdSlot";
import { loadNeighborhoods } from "../lib/data";
import { COMING_SOON_AREAS } from "../lib/constants";

// Leaflet touches window/document directly, so it can only run client-side --
// dynamic-import with ssr disabled instead of a normal import.
const RestaurantMap = dynamic(() => import("../components/RestaurantMap"), { ssr: false });

const PAGE_SIZE = 60;
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

export async function getStaticProps() {
  const neighborhoods = loadNeighborhoods();
  return { props: { neighborhoods } };
}

export default function Home({ neighborhoods }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
    if (neighborhood) list = list.filter((r) => r.nbSlug === neighborhood);
    if (query.trim()) list = list.filter((r) => matchesQuery(r, query));
    return list;
  }, [data, neighborhood, query]);

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
              "@type": "WebSite",
              name: "GutCheck Chicago",
              url: "https://www.gutcheckchicago.com/",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://www.gutcheckchicago.com/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
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
        <div className="search-bar">
          <Search size={18} color="var(--ink-muted)" />
          <input
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

            <div className="chip-row">
              <button className={`chip ${!neighborhood ? "active" : ""}`} onClick={() => { setNeighborhood(null); setVisibleCount(PAGE_SIZE); }}>
                All neighborhoods
              </button>
              {neighborhoods.map((n) => (
                <button
                  key={n.slug}
                  className={`chip ${neighborhood === n.slug ? "active" : ""}`}
                  onClick={() => {
                    setNeighborhood(neighborhood === n.slug ? null : n.slug);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {n.name}
                </button>
              ))}
              {COMING_SOON_AREAS.map((name) => (
                <span key={name} className="chip coming-soon" title="Coming soon — no verified public data source yet">
                  {name} (soon)
                </span>
              ))}
            </div>

            {!data && !loadError && <div className="loading">Loading Chicago&rsquo;s inspection records…</div>}
            {loadError && data?.length === 0 && (
              <div className="empty">Couldn&rsquo;t reach the inspection data feed right now. Try refreshing.</div>
            )}

            {data && filtered.length === 0 && (
              <div className="empty">Nothing on file for that search. Try a different name, neighborhood, or ZIP.</div>
            )}

            {data && filtered.length > 0 && (
              <>
                <div className="grid">
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
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
