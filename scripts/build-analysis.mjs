/**
 * Regenerates data/inspection-analysis.json -- the aggregate findings behind
 * /data.
 *
 * Deliberately NOT part of the build. Producing it means pulling the entire
 * 313k-row inspection history plus violation text, which would add minutes
 * to every deploy for findings that barely move: one more month of data
 * doesn't change whether August is the worst month across 16 years. Run it
 * manually every month or two:
 *
 *   node scripts/build-analysis.mjs
 *
 * The page renders the `generated` date from the file so the reader always
 * knows how current the analysis is.
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "https://data.cityofchicago.org/resource/4ijn-s7e5.json";
const VIOLATION_WINDOW_START = "2021-01-01";

// Chicago overhauled its violation numbering in mid-2018 to align with the
// FDA Food Code. Mixing pre- and post-2018 citations would compare codes
// that mean different things, so violation analysis starts well after the
// changeover.
const BAR_TYPES = ["tavern", "bar", "liquor", "brew pub", "brewpub", "wine tasting store"];

function isFoodService(ft) {
  if (!ft) return false;
  const f = ft.toLowerCase().trim();
  return f === "restaurant" || BAR_TYPES.some((b) => f.includes(b));
}

const GRADED = new Set(["Pass", "Fail", "Pass w/ Conditions"]);
const CODE_RE = /(?:^|\|)\s*(\d{1,2})\.\s*([^-]+?)\s*-\s*Comments:/gi;

async function fetchAll(select, where) {
  const out = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      $select: select,
      $limit: "25000",
      $offset: String(offset),
      $order: "inspection_id",
    });
    if (where) params.set("$where", where);
    const res = await fetch(`${BASE}?${params}`, {
      headers: { "User-Agent": "gutcheck-analysis" },
    });
    if (!res.ok) throw new Error(`Socrata ${res.status}`);
    const batch = await res.json();
    if (batch.length === 0) break;
    out.push(...batch);
    console.log(`  offset ${offset} -> ${batch.length} (total ${out.length})`);
    if (batch.length < 25000) break;
    offset += 25000;
  }
  return out;
}

function parseCodes(text) {
  const found = [];
  CODE_RE.lastIndex = 0;
  let m;
  while ((m = CODE_RE.exec(text || "")) !== null) {
    found.push([parseInt(m[1], 10), m[2].replace(/\s+/g, " ").trim()]);
  }
  return found;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function main() {
  console.log("Fetching full inspection history...");
  const all = await fetchAll(
    "inspection_id,license_,facility_type,risk,inspection_date,inspection_type,results"
  );
  console.log("Fetching violation text...");
  const viol = await fetchAll(
    "inspection_id,license_,facility_type,risk,inspection_date,results,violations",
    `inspection_date >= '${VIOLATION_WINDOW_START}' AND violations IS NOT NULL`
  );

  const r = all.filter((x) => isFoodService(x.facility_type));
  const g = r.filter((x) => GRADED.has(x.results));
  const gv = viol.filter((x) => isFoodService(x.facility_type) && GRADED.has(x.results));

  const out = {
    meta: {
      generated: new Date().toISOString().slice(0, 10),
      source: "City of Chicago Food Inspections (data.cityofchicago.org, dataset 4ijn-s7e5)",
      totalInspectionsInDataset: all.length,
      restaurantBarInspections: r.length,
      gradedInspections: g.length,
      earliest: g.reduce((a, x) => (x.inspection_date < a ? x.inspection_date : a), "9999")
        .slice(0, 10),
      latest: g.reduce((a, x) => (x.inspection_date > a ? x.inspection_date : a), "0")
        .slice(0, 10),
      violationWindowStart: VIOLATION_WINDOW_START,
      violationInspections: gv.length,
    },
  };

  // Seasonality
  const byMonth = {};
  for (const x of g) {
    const m = parseInt(x.inspection_date.slice(5, 7), 10);
    byMonth[m] = byMonth[m] || [0, 0];
    byMonth[m][0]++;
    if (x.results === "Fail") byMonth[m][1]++;
  }
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const [n, f] = byMonth[m];
    months.push({ month: MONTHS[m - 1], n, fails: f, failRate: +((f / n) * 100).toFixed(1) });
  }
  const worst = months.reduce((a, b) => (b.failRate > a.failRate ? b : a));
  const best = months.reduce((a, b) => (b.failRate < a.failRate ? b : a));
  out.seasonality = {
    months,
    worst,
    best,
    relativeGapPct: Math.round((worst.failRate / best.failRate - 1) * 100),
  };

  // Yearly trend
  const byYear = {};
  for (const x of g) {
    const y = parseInt(x.inspection_date.slice(0, 4), 10);
    byYear[y] = byYear[y] || [0, 0];
    byYear[y][0]++;
    if (x.results === "Fail") byYear[y][1]++;
  }
  out.yearly = Object.keys(byYear)
    .map(Number)
    .sort()
    .map((y) => ({ year: y, n: byYear[y][0], failRate: +((byYear[y][1] / byYear[y][0]) * 100).toFixed(1) }));

  // Violations: how often cited, and how often that citation coincides
  // with an actual failure.
  const appear = {}, onFail = {}, titles = {};
  let parsed = 0;
  for (const x of gv) {
    const found = parseCodes(x.violations);
    if (found.length) parsed++;
    const seen = new Set();
    for (const [c, title] of found) {
      if (!titles[c]) titles[c] = title;
      if (seen.has(c)) continue;
      seen.add(c);
      appear[c] = (appear[c] || 0) + 1;
      if (x.results === "Fail") onFail[c] = (onFail[c] || 0) + 1;
    }
  }
  const base = gv.filter((x) => x.results === "Fail").length / gv.length;
  out.violationBaseFailRate = +(base * 100).toFixed(1);
  out.inspectionsParsed = parsed;

  const codes = Object.keys(appear).map(Number);
  out.mostCited = codes
    .sort((a, b) => appear[b] - appear[a])
    .slice(0, 10)
    .map((c) => ({
      code: c,
      title: titles[c],
      count: appear[c],
      shareOfInspections: +((appear[c] / parsed) * 100).toFixed(1),
      failRate: +(((onFail[c] || 0) / appear[c]) * 100).toFixed(1),
      lift: +(((onFail[c] || 0) / appear[c]) / base).toFixed(2),
    }));

  out.mostPredictive = codes
    .filter((c) => appear[c] >= 800)
    .sort((a, b) => (onFail[b] || 0) / appear[b] - (onFail[a] || 0) / appear[a])
    .slice(0, 8)
    .map((c) => ({
      code: c,
      title: titles[c],
      count: appear[c],
      failRate: +(((onFail[c] || 0) / appear[c]) * 100).toFixed(1),
      lift: +(((onFail[c] || 0) / appear[c]) / base).toFixed(2),
    }));

  // Outcome by inspection type
  const byType = {};
  for (const x of g) {
    const t = (x.inspection_type || "").toLowerCase().trim();
    byType[t] = byType[t] || {};
    byType[t][x.results] = (byType[t][x.results] || 0) + 1;
  }
  out.byInspectionType = [
    "canvass", "canvass re-inspection", "complaint",
    "complaint re-inspection", "license", "license re-inspection",
  ]
    .map((t) => {
      const c = byType[t] || {};
      const tot = Object.values(c).reduce((a, b) => a + b, 0);
      if (tot < 200) return null;
      return {
        type: t,
        n: tot,
        passRate: +(((c["Pass"] || 0) / tot) * 100).toFixed(1),
        failRate: +(((c["Fail"] || 0) / tot) * 100).toFixed(1),
      };
    })
    .filter(Boolean);

  // Failure concentration
  const fails = {}, seenLic = {};
  for (const x of g) {
    const lic = x.license_;
    if (!lic) continue;
    seenLic[lic] = true;
    if (x.results === "Fail") fails[lic] = (fails[lic] || 0) + 1;
  }
  const totalFailures = Object.values(fails).reduce((a, b) => a + b, 0);
  const from3Plus = Object.values(fails).filter((n) => n >= 3).reduce((a, b) => a + b, 0);
  out.repeat = {
    establishments: Object.keys(seenLic).length,
    everFailed: Object.keys(fails).length,
    failed3Plus: Object.values(fails).filter((n) => n >= 3).length,
    shareOfFailuresFrom3Plus: +((from3Plus / totalFailures) * 100).toFixed(1),
    totalFailureEvents: totalFailures,
  };

  const dir = path.resolve("data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "inspection-analysis.json"), JSON.stringify(out, null, 1));
  console.log(`Wrote data/inspection-analysis.json (${out.meta.gradedInspections} graded inspections analyzed).`);
}

main().catch((err) => {
  console.error("Analysis failed:", err.message);
  process.exit(1);
});
