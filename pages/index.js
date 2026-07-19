import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { Search } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import RestaurantCard from "../components/RestaurantCard";
import AdSlot from "../components/AdSlot";
import { loadNeighborhoods } from "../lib/data";
import { COMING_SOON_AREAS } from "../lib/constants";

const PAGE_SIZE = 60;
const AD_EVERY = 12;

// Strips apostrophes (straight ' and curly ') before matching, so
// "McDonald's" and "Mcdonalds" return the same results regardless of
// which one the person typed or how the source name is punctuated.
function normalizeForSearch(s) {
  return (s || "").toLowerCase().replace(/['\u2019]/g, "");
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

  useEffect(() => {
    fetch("/data/restaurants.json")
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((json) => setData(json.sort((a, b) => (a.d < b.d ? 1 : -1))))
      .catch(() => {
        setLoadError(true);
        setData([]);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (neighborhood) list = list.filter((r) => r.nbSlug === neighborhood);
    if (query.trim()) {
      const q = normalizeForSearch(query.trim());
      list = list.filter(
        (r) =>
          normalizeForSearch(r.n).includes(q) ||
          normalizeForSearch(r.nb).includes(q) ||
          r.z.includes(query.trim())
      );
    }
    return list;
  }, [data, neighborhood, query]);

  const total = data ? data.length : 0;
  const visible = filtered.slice(0, visibleCount);

  const title = "Chicago Restaurant Health Inspections — GutCheck";
  const description =
    "Look up any Chicago restaurant's official health inspection status — pass, fail, or violations — sourced live from the City of Chicago. Free, updated daily.";

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://gutcheckchicago.com/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://gutcheckchicago.com/og/default.webp" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "GutCheck Chicago",
              url: "https://gutcheckchicago.com/",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://gutcheckchicago.com/?q={search_term_string}",
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
          Search official Chicago health inspection records — pass/fail results, violations,
          and full history, straight from the city&rsquo;s own data.
        </p>
        <div className="search-bar">
          <Search size={18} color="var(--ink-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Chicago restaurant, neighborhood, or ZIP code…"
          />
        </div>
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />

        <h2 className="eyebrow" style={{ marginTop: 22 }}>
          {query.trim() ? `Results for "${query}"` : "All Chicago restaurants"}
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
                  <RestaurantCard r={r} />
                  {(i + 1) % AD_EVERY === 0 && (
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
      </div>

      <Footer />
    </div>
  );
}
