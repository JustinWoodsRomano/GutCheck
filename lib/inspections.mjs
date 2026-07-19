// Shared inspection-processing logic used both by the full build-time data
// pipeline (scripts/fetch-data.mjs) and by individual restaurant pages' ISR
// revalidation (pages/r/[slug]/index.js). The revalidation path re-fetches
// ONE restaurant's rows directly from Socrata (a scoped query, not the full
// ~58k-row dataset) and runs it through the exact same merge/accuracy logic,
// so a restaurant's grade and violations can refresh on their own schedule
// without waiting for a full site rebuild -- and without any risk of the two
// code paths drifting out of sync on how they compute a grade.

const BASE = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
export const CUTOFF = "2022-01-01T00:00:00.000";

export function mapGrade(result) {
  if (result === "Pass") return "PASS";
  if (result === "Pass w/ Conditions") return "CONDITIONAL";
  if (result === "Fail") return "FAIL";
  return null;
}

export function parseViolations(raw) {
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

export function severityRank(grade) {
  if (grade === "FAIL") return 2;
  if (grade === "CONDITIONAL") return 1;
  if (grade === "PASS") return 0;
  return -1;
}

export function toTitleCase(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/'(\w)/g, (_, c) => `'${c.toLowerCase()}`);
}

export function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function stableIdFor(licenseNum, name, address) {
  if (licenseNum && String(licenseNum).trim()) return String(licenseNum).trim();
  let hash = 0;
  const s = `${name}|${address}`;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

// Collapses every row sharing one exact inspection_date into a single
// "visit". Chicago's dataset sometimes issues 2-3 separate license numbers
// for the exact same physical restaurant/visit, so grouping strictly by
// license can silently drop violation text that landed on a sibling license
// row. Grade is worst-of-the-day (FAIL > CONDITIONAL > PASS); violations are
// the de-duplicated union of every row sharing that date.
export function mergeVisits(entries) {
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
      for (const v of parseViolations(row.violations)) {
        if (!seenViolationText.has(v.t)) {
          seenViolationText.add(v.t);
          violations.push(v);
        }
      }
    }
    return { date: d, grade, sourceRow: gradeRow, violations, sawOutOfBusiness };
  });
}

// Builds the same restaurant "shape" fetch-data.mjs's processRows()
// produces, but from an arbitrary (already-fetched) set of raw Socrata rows
// for ONE physical restaurant. Returns null if there's no current graded
// inspection or the business appears out of business, matching the original
// full-dataset skip logic exactly.
export function buildRestaurantFromRows(entries, { neighborhoodFor }) {
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => (a.inspection_date < b.inspection_date ? 1 : -1));

  const visits = mergeVisits(sorted);
  if (visits.length === 0) return null;
  if (visits[0].sawOutOfBusiness) return null;

  const current = visits.find((v) => v.grade !== null);
  if (!current) return null;

  const name = toTitleCase(current.sourceRow.dba_name);
  if (!name) return null;

  const history = visits
    .filter((v) => v.grade !== null)
    .slice(0, 5)
    .map((v) => ({ d: v.date, g: v.grade, v: v.violations }));

  const nb = neighborhoodFor(current.sourceRow.zip);
  const baseSlug = slugify(name) || "restaurant";
  // "0" is Chicago's sentinel value for "no license number issued" on some
  // records, not a real identifier -- treating it as one would mean every
  // unlicensed restaurant in the city shares the "license" 0, which breaks
  // the license-based matching fetchRowsForRestaurant relies on below.
  const licenseCandidates = sorted
    .map((e) => e.license_)
    .filter((l) => l && String(l).trim() && String(l).trim() !== "0");
  const chosenLicense = licenseCandidates.sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  )[0];
  const stableId = stableIdFor(chosenLicense, name, current.sourceRow.address);
  const slug = `${baseSlug}-${stableId}`;

  const lat = parseFloat(current.sourceRow.latitude);
  const lon = parseFloat(current.sourceRow.longitude);

  return {
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
    rawName: current.sourceRow.dba_name,
    rawAddress: current.sourceRow.address,
    license: chosenLicense || null,
  };
}

// Chicago's dataset sometimes records the SAME restaurant's address as
// slightly different text at different points in time under one license
// number (e.g. "6720 S Stony Island Ave" vs "6700 S Stony Island Ave",
// "201-205 E Grand Ave" vs "201 E Grand Ave", a stray trailing space, or a
// corrected house number). Since restaurants are grouped by exact
// (name, address) text, these variants land in separate groups -- but
// because both groups share the same license number, they compute the
// IDENTICAL slug (name + license), producing a genuine slug collision:
// two different array entries claiming the same URL, only one of which
// getStaticProps' slug index can ever resolve to. This merges any such
// collisions after the initial build: the entry with the most recent
// current inspection date wins as the primary/current state, and every
// variant's inspection history is combined (deduplicated by date, most
// severe grade wins per date -- same rule mergeVisits uses -- capped at
// the 5 most recent).
export function mergeSlugCollisions(restaurants) {
  const bySlug = new Map();
  for (const r of restaurants) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
    bySlug.get(r.slug).push(r);
  }

  const merged = [];
  for (const group of bySlug.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => (a.d < b.d ? 1 : -1));
    const primary = sorted[0];

    const histByDate = new Map();
    for (const r of sorted) {
      const entries = [{ d: r.d, g: r.g, v: r.v }, ...(r.hi || [])];
      for (const h of entries) {
        const existing = histByDate.get(h.d);
        if (!existing || severityRank(h.g) > severityRank(existing.g)) {
          histByDate.set(h.d, h);
        }
      }
    }
    const mergedHistory = [...histByDate.values()]
      .sort((a, b) => (a.d < b.d ? 1 : -1))
      .slice(0, 5);

    merged.push({ ...primary, hi: mergedHistory });
  }
  return merged;
}

// Scoped fetch: pulls ONLY the rows for one physical restaurant, instead of
// the full ~58k-row dataset. Matches by exact case-insensitive name+address
// (the same identity key fetch-data.mjs groups the full dataset by) OR, when
// a license number is known, by that SAME name + license number -- Chicago
// sometimes records the same restaurant's address as slightly different
// text over time (see mergeSlugCollisions above), so this second clause
// ensures a revalidation correctly picks up every address-text variant's
// rows for THIS business, not just whichever one is stored in the slug
// index. Deliberately still requires the name to match even in the
// license clause: license numbers can persist across a genuine closure and
// reopening under a different name at the same address (e.g. a business
// goes "Out of Business" and a new concept opens under the same license),
// and matching on license alone would incorrectly pull the closed
// business's rows into a different, unrelated restaurant's page. This is
// what makes per-restaurant ISR revalidation cheap -- each revalidate is a
// small, targeted Socrata query rather than a full refetch.
export async function fetchRowsForRestaurant(rawName, rawAddress, license) {
  const esc = (s) => (s || "").replace(/'/g, "''");
  const nameClause = `upper(dba_name)=upper('${esc(rawName)}')`;
  const addressClause = `(${nameClause} AND upper(address)=upper('${esc(rawAddress)}'))`;
  const licenseClause = license ? ` OR (${nameClause} AND license_='${esc(String(license))}')` : "";
  const params = new URLSearchParams({
    $select: "license_,dba_name,address,zip,inspection_date,results,violations,latitude,longitude",
    $where: `facility_type='Restaurant' AND inspection_date >= '${CUTOFF}' AND (${addressClause}${licenseClause})`,
    $order: "inspection_date DESC",
    $limit: "200",
  });
  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Socrata scoped fetch failed: ${res.status}`);
  return res.json();
}
