// Runs as a "prebuild" step. Fetches live Chicago restaurant inspection
// data at BUILD time, processes it, and writes:
//   - public/data/restaurants.json    (full dataset for the client-side browse UI)
//   - scripts/.data/restaurants.json  (used by neighborhood/homepage getStaticProps)
//   - scripts/.data/slug-index.json   (lean slug -> {n,a} lookup used by
//                                       pages/r/[slug]/index.js to resolve a
//                                       slug into a scoped Socrata query at
//                                       ISR revalidate time, WITHOUT needing
//                                       the full dataset)
//   - public/sitemap.xml
//   - public/llms.txt
//
// As of the ISR migration, individual restaurant pages (pages/r/[slug])
// no longer read their grade/violations from the snapshot this script
// writes -- they revalidate directly against Socrata on their own schedule
// (see lib/inspections.mjs), so a restaurant's accuracy-critical data no
// longer waits on a full rebuild to go live. This script still owns the
// full-dataset snapshot used by the homepage browse list, neighborhood
// pages, sitemap, llms.txt, and OG image generation.

import fs from "node:fs";
import path from "node:path";
import { generateAllOgImages, generateGenericOgImage, OG_DESIGN_VERSION } from "./generate-og-images.mjs";
import { buildRestaurantFromRows, mergeSlugCollisions, CUTOFF, facilityTypeWhereClause } from "../lib/inspections.mjs";
import { neighborhoodFor } from "../lib/zipNeighborhoods.mjs";
import {
  communityAreaFor,
  allCommunityAreas,
  vernacularNeighborhoodFor,
  allVernacularNeighborhoods,
  NEIGHBORHOOD_ALIASES,
} from "../lib/communityAreas.mjs";

const BASE = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
const SITE_URL = "https://www.gutcheckchicago.com";

// Suburbs requested but not yet sourced from a verified open-data feed.
// Shown in the UI as "coming soon" — never populated with fabricated data.
export const COMING_SOON_AREAS = ["Oak Park", "Elmwood Park", "Rosemont"];

async function fetchAllRows() {
  const rows = [];
  let offset = 0;
  const limit = 50000;
  for (let page = 0; page < 6; page++) {
    const params = new URLSearchParams({
      $select: "license_,dba_name,address,zip,inspection_date,inspection_type,results,violations,latitude,longitude",
      $where: `${facilityTypeWhereClause()} AND inspection_date >= '${CUTOFF}'`,
      $order: "inspection_date DESC",
      $limit: String(limit),
      $offset: String(offset),
    });
    const res = await fetch(`${BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    console.log(`fetched offset=${offset} -> ${batch.length} rows (total ${rows.length})`);
    if (batch.length < limit) break;
    offset += limit;
  }
  return rows;
}

// Chicago's inspection dataset assigns a separate license_ number per
// business license, but a single physical restaurant frequently gets
// inspected under MULTIPLE license numbers for the exact same visit
// (e.g. distinct license types, or administrative re-issuance) --
// confirmed directly against the live feed: hundreds of (name, address,
// date) triples have 2-4 different license_ values. Critically, the
// city's dataset sometimes records the actual violation text under only
// ONE of those license rows, leaving sibling rows with a real Fail/Pass
// result but a BLANK violations field. Grouping by license_ alone (as
// this used to do) creates duplicate listings for the same restaurant,
// some of which showed a failing grade with a misleading "no violations"
// state -- a real accuracy bug for a site whose entire premise is
// accurate public safety data. Grouping by (name, address) instead
// reliably identifies "the same physical restaurant" for this dataset,
// and merging every row that shares an exact inspection_date within that
// group (rather than picking one arbitrary row, via mergeVisits() in
// lib/inspections.mjs) ensures violation text recorded under a sibling
// license number is never dropped. This groups the full dataset and
// delegates the actual per-restaurant build to buildRestaurantFromRows()
// -- the SAME function pages/r/[slug]/index.js calls at ISR revalidate
// time on a scoped per-restaurant fetch, so both code paths are
// guaranteed to compute a restaurant's grade identically.
function processRows(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${(r.dba_name || "").trim().toUpperCase()}|${(r.address || "").trim().toUpperCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const built = [];
  for (const entries of groups.values()) {
    const restaurant = buildRestaurantFromRows(entries, { neighborhoodFor });
    if (restaurant) built.push(restaurant);
  }

  // Collapses any restaurants that landed in separate (name, address)
  // groups but share a license number and therefore computed the same
  // slug -- see mergeSlugCollisions in lib/inspections.mjs for why this
  // happens and how the merge is resolved.
  const deduped = mergeSlugCollisions(built);
  return deduped.map((r, i) => ({ id: i + 1, ...r }));
}

function buildSitemap(restaurants, neighborhoods) {
  const urls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/faq`, priority: "0.6" },
    { loc: `${SITE_URL}/hall-of-shame`, priority: "0.6" },
    { loc: `${SITE_URL}/data`, priority: "0.8" },
    { loc: `${SITE_URL}/food-inspection-map`, priority: "0.7" },
    { loc: `${SITE_URL}/about`, priority: "0.5" },
    { loc: `${SITE_URL}/privacy`, priority: "0.2" },
    { loc: `${SITE_URL}/terms`, priority: "0.2" },
    { loc: `${SITE_URL}/cookies`, priority: "0.2" },
    ...neighborhoods.map((n) => ({ loc: `${SITE_URL}/n/${n}`, priority: "0.7" })),
    ...restaurants.map((r) => ({ loc: `${SITE_URL}/r/${r.slug}`, priority: "0.5", lastmod: r.d })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildLlmsTxt(restaurantCount, neighborhoods) {
  return `# GutCheck Chicago

> Official Chicago restaurant health inspection records — pass/fail results,
> violations, and inspection history — sourced directly from the City of
> Chicago's public Food Inspections open-data feed (data.cityofchicago.org,
> dataset 4ijn-s7e5), rebuilt daily.

- Currently indexes ${restaurantCount.toLocaleString()} active Chicago restaurants and bars across ${neighborhoods.length} neighborhoods.
- Each restaurant has its own page at /r/{slug} with current grade (Pass / Pass w/ Conditions / Fail), listed violations, and up to 5 most recent inspections.
- Neighborhood directories are at /n/{neighborhood-slug}.
- FAQ (methodology, grading system explanation): /faq
- Chicago food inspection map, inspection types explained, and what Pass /
  Pass w Conditions / Fail actually mean: /food-inspection-map
- Original analysis of 16 years of Chicago inspection data -- which violations
  are cited most, which actually predict a failure, seasonality, and repeat
  offenders: /data
- About / data sourcing and update cadence: /about

## Key facts for citation
- Data source: City of Chicago Department of Public Health, Food Protection Program.
- Grading system: Pass, Pass w/ Conditions, Fail (in effect since July 2018; violations are further classified Priority, Priority Foundation, or Core).
- Update cadence: rebuilt from the live feed on every deploy.
- GutCheck is an independent service, not affiliated with the City of Chicago.
`;
}

// Categorizes free-text violation comments into recognizable food-safety
// categories using real City of Chicago health-code violation language
// (these categories mirror the city's own inspection code sections, not
// invented labels), so neighborhood-page copy can cite genuine, specific
// patterns instead of generic filler.
const VIOLATION_CATEGORIES = [
  { key: "pest control", re: /\b(rodent|mice|mouse|roach|cockroach|vermin|insect|pest|infestation)\b/i },
  { key: "handwashing & hygiene", re: /\b(hand ?wash|handwashing|hand sink|employee hygiene|bare hand)\b/i },
  { key: "food temperature control", re: /\b(cold hold|hot hold|temperature|thermometer|cooling|reheat)\b/i },
  { key: "cross-contamination", re: /\b(cross[- ]?contaminat|raw (meat|chicken|poultry) (stored|above))\b/i },
  { key: "facility maintenance", re: /\b(floor|ceiling|wall|plumbing|leak|drain|ventilation|repair)\b/i },
  { key: "food storage", re: /\b(food storage|improperly stored|labeling|expired|date mark)\b/i },
  { key: "sanitation & cleaning", re: /\b(sanitiz|clean(ing|ed)?|dish ?wash|wash.{0,15}rinse.{0,15}sanit)\b/i },
  { key: "certified food manager", re: /\b(certified food manager|food service sanitation|CFM)\b/i },
];

function categorizeViolations(violationText) {
  const hits = [];
  for (const cat of VIOLATION_CATEGORIES) {
    if (cat.re.test(violationText)) hits.push(cat.key);
  }
  return hits;
}

// Chicago writes violations as "NN. TITLE - Comments: ...", pipe-separated.
// Pulling the numbered code is far more precise than keyword matching --
// it's the city's own classification rather than our inference about it.
const VIOLATION_CODE_RE = /(?:^|\|)\s*(\d{1,2})\.\s*([^-]+?)\s*-\s*Comments:/gi;

function extractViolationCodes(text) {
  const out = [];
  VIOLATION_CODE_RE.lastIndex = 0;
  let m;
  while ((m = VIOLATION_CODE_RE.exec(text || "")) !== null) {
    out.push({ code: parseInt(m[1], 10), title: m[2].replace(/\s+/g, " ").trim() });
  }
  return out;
}

function titleCaseViolation(s) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 || w === "&" ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function buildNeighborhoodStats(restaurants) {
  // A restaurant contributes to BOTH its vernacular neighborhood and its
  // official community area, because both get their own page. Keying only
  // by nbSlug left every community-area page with no stats at all.
  const byNb = new Map();
  const push = (slug, r) => {
    if (!slug) return;
    if (!byNb.has(slug)) byNb.set(slug, []);
    byNb.get(slug).push(r);
  };
  for (const r of restaurants) {
    const slugs = new Set(
      [r.nbSlug, r.caSlug, r.vnSlug, ...(r.aliasSlugs || [])].filter(Boolean)
    );
    for (const s of slugs) push(s, r);
  }

  const citywideTotal = restaurants.length;
  const citywidePass = restaurants.filter((r) => r.g === "PASS").length;
  const citywidePassRate = Math.round((citywidePass / citywideTotal) * 100);

  const stats = {};
  for (const [slug, list] of byNb) {
    const total = list.length;
    const pass = list.filter((r) => r.g === "PASS").length;
    const conditional = list.filter((r) => r.g === "CONDITIONAL").length;
    const fail = list.filter((r) => r.g === "FAIL").length;
    const passRate = Math.round((pass / total) * 100);

    const catCounts = {};
    const codeCounts = {};
    const codeTitles = {};
    let withViolations = 0;
    for (const r of list) {
      const text = (r.v || []).map((v) => v.t).join(" | ");
      for (const cat of categorizeViolations(text)) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
      const codes = (r.v || []).filter((v) => v.c).map((v) => ({ code: v.c, title: v.ct }));
      if (codes.length) withViolations++;
      // Count each code once per establishment, so this reads as "how many
      // places got cited for this" rather than raw citation volume.
      const seen = new Set();
      for (const { code, title } of codes) {
        if (!codeTitles[code]) codeTitles[code] = titleCaseViolation(title);
        if (seen.has(code)) continue;
        seen.add(code);
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      }
    }
    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);

    const topViolations = Object.entries(codeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, n]) => ({
        code: Number(code),
        title: codeTitles[code],
        count: n,
        share: withViolations ? Math.round((n / withViolations) * 100) : 0,
      }));

    // Recent activity window: inspections in the last 30 days of data.
    const dates = list.map((r) => r.d).filter(Boolean).sort();
    const mostRecentDate = dates[dates.length - 1] || null;
    const thirtyDaysAgo = mostRecentDate
      ? new Date(new Date(mostRecentDate).getTime() - 30 * 86400000).toISOString().slice(0, 10)
      : null;
    const recentInspectionCount = thirtyDaysAgo ? list.filter((r) => r.d >= thirtyDaysAgo).length : 0;

    stats[slug] = {
      total,
      pass,
      conditional,
      fail,
      passRate,
      vsCitywide: passRate - citywidePassRate,
      topCategories,
      topViolations,
      establishmentsWithViolations: withViolations,
      recentInspectionCount,
    };
  }
  // Citywide equivalent, for the homepage.
  const cityCodeCounts = {};
  const cityCodeTitles = {};
  let cityWithViolations = 0;
  for (const r of restaurants) {
    const text = (r.v || []).map((v) => v.t).join(" | ");
    const codes = (r.v || []).filter((v) => v.c).map((v) => ({ code: v.c, title: v.ct }));
    if (codes.length) cityWithViolations++;
    const seen = new Set();
    for (const { code, title } of codes) {
      if (!cityCodeTitles[code]) cityCodeTitles[code] = titleCaseViolation(title);
      if (seen.has(code)) continue;
      seen.add(code);
      cityCodeCounts[code] = (cityCodeCounts[code] || 0) + 1;
    }
  }
  const citywideTopViolations = Object.entries(cityCodeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, n]) => ({
      code: Number(code),
      title: cityCodeTitles[code],
      count: n,
      share: cityWithViolations ? Math.round((n / cityWithViolations) * 100) : 0,
    }));

  return {
    citywidePassRate,
    citywideTopViolations,
    citywideWithViolations: cityWithViolations,
    byNeighborhood: stats,
  };
}

const outDataDir = path.resolve("public/data");
const outBuildDir = path.resolve("scripts/.data");
fs.mkdirSync(outDataDir, { recursive: true });
fs.mkdirSync(outBuildDir, { recursive: true });

try {
  console.log("Fetching live Chicago restaurant inspection data...");
  const rows = await fetchAllRows();
  const restaurants = processRows(rows);
  // Two complementary geographies:
  //   nbSlug  - vernacular neighborhood (Wicker Park, West Loop, Pilsen...).
  //             These carry essentially all the real search demand.
  //   caSlug  - official City of Chicago community area, derived from the
  //             record's own lat/lon. Covers all 77 areas, including the 40
  //             the ZIP mapping never reached.
  // A restaurant belongs to both, and gets listed on both pages. Where a
  // vernacular slug and a community-area slug are the same place (e.g.
  // "loop", "uptown"), it collapses to a single page.
  for (const r of restaurants) {
    const ca = communityAreaFor(r.lat, r.lon);
    r.ca = ca ? ca.name : null;
    r.caSlug = ca ? ca.slug : null;
    // Vernacular neighborhood, also from coordinates. This is the layer
    // that captures Bucktown, Andersonville, Wrigleyville, Old Town and
    // 90-odd others that neither ZIP mapping nor community areas reach.
    const vn = vernacularNeighborhoodFor(r.lat, r.lon);
    r.vn = vn ? vn.name : null;
    r.vnSlug = vn ? vn.slug : null;
    // Legacy names that are still the highest-volume term for their area.
    r.aliasSlugs = Object.entries(NEIGHBORHOOD_ALIASES)
      .filter(([, cfg]) => vn && cfg.covers.includes(vn.slug))
      .map(([slug]) => slug);
  }

  const vernacularSlugs = new Set(restaurants.map((r) => r.nbSlug).filter(Boolean));
  const caSlugs = new Set(restaurants.map((r) => r.caSlug).filter(Boolean));
  const vnSlugs = new Set(restaurants.map((r) => r.vnSlug).filter(Boolean));
  const aliasSlugs = new Set(restaurants.flatMap((r) => r.aliasSlugs || []));
  const neighborhoods = [
    ...new Set([...vernacularSlugs, ...caSlugs, ...vnSlugs, ...aliasSlugs]),
  ].sort();

  const caNameBySlug = {};
  for (const a of allCommunityAreas()) caNameBySlug[a.slug] = a.name;
  const vnNameBySlug = {};
  for (const a of allVernacularNeighborhoods()) vnNameBySlug[a.slug] = a.name;
  const aliasNameBySlug = {};
  for (const [slug, cfg] of Object.entries(NEIGHBORHOOD_ALIASES)) aliasNameBySlug[slug] = cfg.name;
  const vernacularNameBySlug = {};
  for (const r of restaurants) {
    if (r.nbSlug && !vernacularNameBySlug[r.nbSlug]) vernacularNameBySlug[r.nbSlug] = r.nb;
  }
  // Vernacular label wins on collision -- it's the name people search.
  const neighborhoodMeta = {};
  for (const slug of neighborhoods) {
    // Name priority: the coordinate-derived vernacular name is both accurate
    // and the one people search, so it wins over the community-area label
    // and over the old ZIP-derived guess.
    const name =
      vnNameBySlug[slug] ||
      aliasNameBySlug[slug] ||
      vernacularNameBySlug[slug] ||
      caNameBySlug[slug] ||
      slug;
    let kind = "community-area";
    if (aliasNameBySlug[slug]) kind = "vernacular";
    else if (vnSlugs.has(slug)) kind = caSlugs.has(slug) ? "both" : "vernacular";
    else if (vernacularSlugs.has(slug)) kind = "vernacular";
    neighborhoodMeta[slug] = {
      slug,
      name,
      kind,
      officialName: caNameBySlug[slug] || null,
    };
  }
  const assignedCa = restaurants.filter((r) => r.caSlug).length;
  console.log(
    `Community areas: ${caSlugs.size} populated, ${assignedCa}/${restaurants.length} records placed by coordinates.`
  );
  console.log(
    `Neighborhood pages: ${neighborhoods.length} ` +
      `(${vnSlugs.size} vernacular + ${caSlugs.size} community areas + ` +
      `${aliasSlugs.size} legacy aliases, deduped).`
  );
  const neighborhoodStats = buildNeighborhoodStats(restaurants);

  // Lean slug -> {n: raw dba_name, a: raw address} index. pages/r/[slug]
  // uses this at ISR revalidate time to resolve a slug into the exact
  // upper()-matched Socrata query fetchRowsForRestaurant() needs, without
  // loading the full (much larger, violation-history-inclusive) dataset.
  // Uses the RAW (not title-cased) values since that's what has to match
  // Socrata's own stored casing for an exact upper() comparison.
  const slugIndex = {};
  for (const r of restaurants) slugIndex[r.slug] = { n: r.rawName, a: r.rawAddress, l: r.license };
  fs.writeFileSync(path.join(outBuildDir, "slug-index.json"), JSON.stringify(slugIndex));

  // rawName/rawAddress only exist to seed slugIndex above -- strip them
  // before writing the public-facing dataset so it stays lean and doesn't
  // carry two redundant near-duplicates of every restaurant's name/address.
  const publicRestaurants = restaurants.map(({ rawName, rawAddress, license, ...rest }) => rest);

  // The homepage's client-side browse/search UI (pages/index.js) only ever
  // reads id, slug, n, nb, nbSlug, z, g, d from each restaurant -- it never
  // touches violations (v), inspection history (hi), street address (a), or
  // coordinates (lat/lon); those are only used on individual restaurant
  // detail pages, which get their data through a completely separate path
  // (ISR + a scoped per-restaurant Socrata fetch in pages/r/[slug], see
  // lib/inspections.mjs) and never read this file at all. Measured directly
  // against a production snapshot: hi + v alone accounted for 95.7% of this
  // file's total bytes (81.5% + 14.2%), for data the browse page was
  // downloading on every single visit and never using. That produced a
  // ~26.6MB client-side fetch -- large enough to fail outright on a slow or
  // spotty mobile connection, which is what actually caused the "Couldn't
  // reach the inspection data feed right now" error a person hit on 5G with
  // a couple bars of signal. Trimming to only the fields the browse UI
  // reads cuts this to roughly 1/30th the size with zero loss of
  // functionality anywhere. The FULL dataset (with v/hi/a/lat/lon intact)
  // still gets written to scripts/.data/restaurants.json below, which is
  // what loadRestaurants() reads server-side for pages that do need those
  // fields (e.g. pages/hall-of-shame.js reading a specific violation) --
  // only the client-fetched public copy is trimmed.
  const browseRestaurants = publicRestaurants.map(({ id, slug, n, nb, nbSlug, z, g, d, lat, lon, ca, caSlug, vn, vnSlug }) => ({
    id,
    slug,
    n,
    nb,
    nbSlug,
    z,
    g,
    d,
    // Coordinate-derived official community area. This is the ACCURATE
    // geography -- the ZIP-derived `nb` above is wrong for a large share of
    // records (only 17 of 117 "Portage Park" ZIP restaurants are actually
    // in Portage Park). Cards display `ca`; `nb` is retained because the
    // vernacular slugs are what carry the search volume.
    ca,
    caSlug,
    vn,
    vnSlug,
    // Rounded to 5 decimals (~1.1m precision) -- plenty for map pins,
    // saves bytes across 8,000+ records vs full float precision.
    lat: lat != null ? Math.round(lat * 100000) / 100000 : null,
    lon: lon != null ? Math.round(lon * 100000) / 100000 : null,
  }));

  fs.writeFileSync(path.join(outDataDir, "restaurants.json"), JSON.stringify(browseRestaurants));
  fs.writeFileSync(path.join(outBuildDir, "restaurants.json"), JSON.stringify(publicRestaurants));
  fs.writeFileSync(path.join(outBuildDir, "neighborhood-stats.json"), JSON.stringify(neighborhoodStats));
  fs.writeFileSync(path.join(outBuildDir, "neighborhood-meta.json"), JSON.stringify(neighborhoodMeta));
  fs.writeFileSync(path.resolve("public/sitemap.xml"), buildSitemap(publicRestaurants, neighborhoods));
  fs.writeFileSync(path.resolve("public/llms.txt"), buildLlmsTxt(publicRestaurants.length, neighborhoods));

  console.log("Generating Open Graph images...");
  const ogStart = Date.now();
  const ogDir = path.resolve("public/og");
  fs.mkdirSync(ogDir, { recursive: true });

  // The build cache persists public/og/*.webp between deploys, and image
  // generation skips any file that already exists (regenerating all
  // 9,700+ images on every build would be far too slow). That means a
  // design change in generate-og-images.mjs would otherwise silently
  // never apply to a restaurant that already had an image -- forever.
  // Comparing against a version marker catches that: any mismatch wipes
  // every cached image so the whole set regenerates under the new design
  // exactly once, then future builds go back to the fast skip-existing
  // path. Named without a leading dot -- a dotfile here previously failed
  // to survive Vercel's build-cache restoration between deploys, which
  // silently forced a full unnecessary regeneration on the next build.
  const versionFile = path.join(ogDir, "design-version.txt");
  const cachedVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf-8").trim() : null;
  if (cachedVersion !== String(OG_DESIGN_VERSION)) {
    console.log(`OG design version changed (${cachedVersion ?? "none"} -> ${OG_DESIGN_VERSION}); clearing cached images for full regeneration.`);
    for (const f of fs.readdirSync(ogDir)) {
      if (f.endsWith(".webp")) fs.unlinkSync(path.join(ogDir, f));
    }
    fs.writeFileSync(versionFile, String(OG_DESIGN_VERSION));
  }

  fs.writeFileSync(path.join(ogDir, "default.webp"), generateGenericOgImage());
  const ogCount = await generateAllOgImages(restaurants, ogDir, { skipExisting: true });
  console.log(`Generated ${ogCount + 1} restaurant OG images in ${((Date.now() - ogStart) / 1000).toFixed(1)}s`);

  console.log(`Wrote ${restaurants.length} restaurants across ${neighborhoods.length} neighborhoods.`);
} catch (err) {
  console.error("Live fetch failed, writing empty fallback so the build still succeeds:", err);
  fs.writeFileSync(path.join(outDataDir, "restaurants.json"), JSON.stringify([]));
  fs.writeFileSync(path.join(outBuildDir, "restaurants.json"), JSON.stringify([]));
  fs.writeFileSync(path.join(outBuildDir, "slug-index.json"), JSON.stringify({}));
  fs.writeFileSync(path.resolve("public/sitemap.xml"), buildSitemap([], []));
  fs.writeFileSync(path.resolve("public/llms.txt"), buildLlmsTxt(0, []));
}
