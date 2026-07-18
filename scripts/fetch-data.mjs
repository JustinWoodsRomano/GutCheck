// Runs as a "prebuild" step. Fetches live Chicago restaurant inspection
// data at BUILD time, processes it, and writes:
//   - public/data/restaurants.json  (full dataset for the client-side browse UI)
//   - scripts/.data/restaurants-by-slug.json (used by getStaticProps/getStaticPaths)
//   - public/sitemap.xml
//   - public/llms.txt
// Nothing here runs at request time — everything is baked in at build time,
// which is what makes 9,700+ individual restaurant pages possible without
// any serverless function or timeout risk.

import fs from "node:fs";
import path from "node:path";
import { generateAllOgImages, generateGenericOgImage, OG_DESIGN_VERSION } from "./generate-og-images.mjs";

const BASE = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
const CUTOFF = "2022-01-01T00:00:00.000";
const SITE_URL = "https://gutcheckchicago.com";

const ZIP_NEIGHBORHOOD = {
  "60601": "Loop", "60602": "Loop", "60603": "Loop", "60604": "Loop",
  "60605": "South Loop", "60606": "West Loop", "60607": "West Loop",
  "60608": "Pilsen", "60609": "Back of the Yards", "60610": "Near North Side",
  "60611": "Streeterville", "60612": "East Garfield Park", "60613": "Lakeview",
  "60614": "Lincoln Park", "60615": "Hyde Park", "60616": "Chinatown",
  "60617": "South Chicago", "60618": "North Center", "60619": "Chatham",
  "60620": "Auburn Gresham", "60621": "Englewood", "60622": "Wicker Park",
  "60623": "Little Village", "60624": "West Garfield Park", "60625": "Albany Park",
  "60626": "Rogers Park", "60628": "Roseland", "60629": "Gage Park",
  "60630": "Portage Park", "60631": "Edison Park", "60632": "Archer Heights",
  "60633": "Hegewisch", "60634": "Dunning", "60636": "West Englewood",
  "60637": "Woodlawn", "60638": "Garfield Ridge", "60639": "Belmont Cragin",
  "60640": "Uptown", "60641": "Irving Park", "60642": "Noble Square",
  "60643": "Beverly", "60644": "Austin", "60645": "West Ridge",
  "60646": "Forest Glen", "60647": "Logan Square", "60649": "South Shore",
  "60651": "Humboldt Park", "60652": "Ashburn", "60653": "Bronzeville",
  "60654": "River North", "60655": "Mount Greenwood", "60656": "Norwood Park",
  "60657": "Lakeview", "60659": "West Rogers Park", "60660": "Edgewater",
  "60661": "West Loop", "60664": "Loop", "60666": "O'Hare",
  "60827": "Riverdale", "60707": "Dunning",
};

// Suburbs requested but not yet sourced from a verified open-data feed.
// Shown in the UI as "coming soon" — never populated with fabricated data.
export const COMING_SOON_AREAS = ["Oak Park", "Elmwood Park", "Rosemont"];

function neighborhoodFor(zip) {
  const z = (zip || "").trim().slice(0, 5);
  return ZIP_NEIGHBORHOOD[z] || "Other Chicago";
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toTitleCase(s) {
  // \b\w capitalizes every letter that follows a non-word character,
  // and an apostrophe counts as one -- so "mcdonald's" incorrectly
  // becomes "Mcdonald'S". Undo that specific case: an apostrophe is
  // virtually always a possessive/contraction in these names, so the
  // letter right after it should stay lowercase (McDonald's, Andy's,
  // Wendy's, etc.).
  return (s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/'(\w)/g, (_, c) => `'${c.toLowerCase()}`);
}

function mapGrade(result) {
  if (result === "Pass") return "PASS";
  if (result === "Pass w/ Conditions") return "CONDITIONAL";
  if (result === "Fail") return "FAIL";
  return null;
}

function parseViolations(raw) {
  if (!raw) return [];
  return raw
    .split(" | ")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split(/\s*-\s*Comments:\s*/i);
      const comment = (parts[1] || chunk).replace(/\s+/g, " ").trim().slice(0, 220);
      const isCritical = /PRIORITY FOUNDATION|PRIORITY VIOLATION/.test(chunk);
      return { t: comment, s: isCritical ? "c" : "n" };
    });
}

async function fetchAllRows() {
  const rows = [];
  let offset = 0;
  const limit = 50000;
  for (let page = 0; page < 6; page++) {
    const params = new URLSearchParams({
      $select: "license_,dba_name,address,zip,inspection_date,results,violations,latitude,longitude",
      $where: `facility_type='Restaurant' AND inspection_date >= '${CUTOFF}'`,
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

function stableIdFor(licenseNum, name, address) {
  if (licenseNum && String(licenseNum).trim()) return String(licenseNum).trim();
  // Fallback for the rare record with no license number: short stable hash
  // of name+address so the slug still doesn't depend on fetch/processing order.
  let hash = 0;
  const s = `${name}|${address}`;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
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
// group (rather than picking one arbitrary row) ensures violation text
// recorded under a sibling license number is never dropped.
function severityRank(grade) {
  if (grade === "FAIL") return 2;
  if (grade === "CONDITIONAL") return 1;
  if (grade === "PASS") return 0;
  return -1;
}

// Collapses every row sharing one exact inspection_date into a single
// "visit": violations are the union of every row's violations (a
// sibling license record may hold text a Fail record itself lacks), and
// the grade is the most severe one recorded for that date -- if any
// license record for that visit says Fail, the visit is a Fail. Rows
// are pre-sorted newest-first by the caller.
function mergeVisits(entries) {
  const byDate = new Map();
  const order = [];
  for (const e of entries) {
    const d = (e.inspection_date || "").slice(0, 10);
    if (!d) continue;
    if (!byDate.has(d)) {
      byDate.set(d, []);
      order.push(d);
    }
    byDate.get(d).push(e);
  }

  return order.map((d) => {
    const rows = byDate.get(d);
    let grade = null;
    let gradeRow = rows[0];
    const violations = [];
    const seenViolationText = new Set();
    let sawOutOfBusiness = false;
    for (const row of rows) {
      if (row.results === "Out of Business") sawOutOfBusiness = true;
      const g = mapGrade(row.results);
      if (g && severityRank(g) > severityRank(grade)) {
        grade = g;
        gradeRow = row;
      }
      // Verified against the live feed: when Chicago inspects one physical
      // location under multiple license numbers on the same visit, the
      // same violation text is sometimes recorded verbatim on more than
      // one sibling license row. Deduping by exact text keeps each real
      // violation listed once -- otherwise the merge above would make a
      // restaurant look like it had more issues than inspectors actually
      // found.
      for (const v of parseViolations(row.violations)) {
        if (!seenViolationText.has(v.t)) {
          seenViolationText.add(v.t);
          violations.push(v);
        }
      }
    }
    return { date: d, grade, sourceRow: gradeRow, violations, sawOutOfBusiness, allRows: rows };
  });
}

function processRows(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${(r.dba_name || "").trim().toUpperCase()}|${(r.address || "").trim().toUpperCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const restaurants = [];
  let id = 1;

  for (const entries of groups.values()) {
    entries.sort((a, b) => (a.inspection_date < b.inspection_date ? 1 : -1));

    const visits = mergeVisits(entries);
    if (visits.length === 0) continue;
    if (visits[0].sawOutOfBusiness) continue;

    const current = visits.find((v) => v.grade !== null);
    if (!current) continue;

    const name = toTitleCase(current.sourceRow.dba_name);
    if (!name) continue;

    const history = visits
      .filter((v) => v.grade !== null)
      .slice(0, 5)
      .map((v) => ({ d: v.date, g: v.grade, v: v.violations }));

    const nb = neighborhoodFor(current.sourceRow.zip);
    const baseSlug = slugify(name) || "restaurant";
    // Deterministic across rebuilds: the lowest license number seen
    // anywhere in this group, not whichever row happened to carry the
    // grade -- keeps the slug stable even if which sibling row holds the
    // violation text shifts between city data refreshes.
    const licenseCandidates = entries.map((e) => e.license_).filter((l) => l && String(l).trim());
    const chosenLicense = licenseCandidates.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))[0];
    const stableId = stableIdFor(chosenLicense, name, current.sourceRow.address);
    const slug = `${baseSlug}-${stableId}`;

    const lat = parseFloat(current.sourceRow.latitude);
    const lon = parseFloat(current.sourceRow.longitude);

    restaurants.push({
      id: id++,
      slug,
      n: name,
      nb,
      nbSlug: slugify(nb),
      z: (current.sourceRow.zip || "").slice(0, 5),
      a: toTitleCase(current.sourceRow.address),
      g: current.grade,
      d: current.date,
      v: current.violations,
      hi: history,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
    });
  }

  return restaurants;
}

function buildSitemap(restaurants, neighborhoods) {
  const urls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/faq`, priority: "0.6" },
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

- Currently indexes ${restaurantCount.toLocaleString()} active Chicago restaurants across ${neighborhoods.length} neighborhoods.
- Each restaurant has its own page at /r/{slug} with current grade (Pass / Pass w/ Conditions / Fail), listed violations, and up to 5 most recent inspections.
- Neighborhood directories are at /n/{neighborhood-slug}.
- FAQ (methodology, grading system explanation): /faq
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

function buildNeighborhoodStats(restaurants) {
  const byNb = new Map();
  for (const r of restaurants) {
    if (!byNb.has(r.nbSlug)) byNb.set(r.nbSlug, []);
    byNb.get(r.nbSlug).push(r);
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
    for (const r of list) {
      const text = (r.v || []).map((v) => v.t).join(" ");
      for (const cat of categorizeViolations(text)) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
    }
    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);

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
      recentInspectionCount,
    };
  }
  return { citywidePassRate, byNeighborhood: stats };
}

const outDataDir = path.resolve("public/data");
const outBuildDir = path.resolve("scripts/.data");
fs.mkdirSync(outDataDir, { recursive: true });
fs.mkdirSync(outBuildDir, { recursive: true });

try {
  console.log("Fetching live Chicago restaurant inspection data...");
  const rows = await fetchAllRows();
  const restaurants = processRows(rows);
  const neighborhoods = [...new Set(restaurants.map((r) => r.nbSlug))].sort();
  const neighborhoodStats = buildNeighborhoodStats(restaurants);

  fs.writeFileSync(path.join(outDataDir, "restaurants.json"), JSON.stringify(restaurants));
  fs.writeFileSync(path.join(outBuildDir, "restaurants.json"), JSON.stringify(restaurants));
  fs.writeFileSync(path.join(outBuildDir, "neighborhood-stats.json"), JSON.stringify(neighborhoodStats));
  fs.writeFileSync(path.resolve("public/sitemap.xml"), buildSitemap(restaurants, neighborhoods));
  fs.writeFileSync(path.resolve("public/llms.txt"), buildLlmsTxt(restaurants.length, neighborhoods));

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
  fs.writeFileSync(path.resolve("public/sitemap.xml"), buildSitemap([], []));
  fs.writeFileSync(path.resolve("public/llms.txt"), buildLlmsTxt(0, []));
}
