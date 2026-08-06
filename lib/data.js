// SERVER-ONLY. Never import this from a component that renders client-side —
// it touches the filesystem and must only be used inside getStaticProps /
// getStaticPaths, which run at build time in Node.

import fs from "node:fs";
import path from "node:path";

let _cache = null;

export function loadRestaurants() {
  if (_cache) return _cache;
  const p = path.resolve("scripts/.data/restaurants.json");
  const raw = fs.readFileSync(p, "utf-8");
  _cache = JSON.parse(raw);
  return _cache;
}

// Every neighborhood page we generate: vernacular neighborhoods (Wicker
// Park, West Loop, Pilsen -- where the search demand actually is) plus all
// 77 official community areas, deduped where they name the same place.
let _metaCache = null;
export function loadNeighborhoodMeta() {
  if (_metaCache) return _metaCache;
  const p = path.resolve("scripts/.data/neighborhood-meta.json");
  _metaCache = JSON.parse(fs.readFileSync(p, "utf-8"));
  return _metaCache;
}

export function loadNeighborhoods() {
  const meta = loadNeighborhoodMeta();
  return Object.values(meta)
    .map(({ slug, name }) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let _statsCache = null;
export function loadNeighborhoodStats() {
  if (_statsCache) return _statsCache;
  const p = path.resolve("scripts/.data/neighborhood-stats.json");
  const raw = fs.readFileSync(p, "utf-8");
  _statsCache = JSON.parse(raw);
  return _statsCache;
}

// slug -> { n: raw dba_name, a: raw address }. Small and fast to load, so
// getStaticProps for an individual restaurant page can resolve a slug into
// a scoped Socrata identity lookup (see lib/inspections.mjs) without
// needing the full, much larger restaurants.json.
let _slugIndexCache = null;
export function loadSlugIndex() {
  if (_slugIndexCache) return _slugIndexCache;
  const p = path.resolve("scripts/.data/slug-index.json");
  const raw = fs.readFileSync(p, "utf-8");
  _slugIndexCache = JSON.parse(raw);
  return _slugIndexCache;
}

// Licences the city has marked "Out of Business" with no later graded
// inspection. Built in scripts/fetch-data.mjs -- see buildClosures there for
// why the later-inspection guard exists.
let _closuresCache = null;
export function loadClosures() {
  if (_closuresCache) return _closuresCache;
  const p = path.resolve("scripts/.data/closures.json");
  try {
    _closuresCache = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    // First build, or the fetch fell back to its empty-data path.
    _closuresCache = [];
  }
  return _closuresCache;
}

/**
 * Active restaurant count for the header.
 *
 * loadRestaurants() and loadSlugIndex() now both include archived closures,
 * because those records stay searchable and keep their pages. The number in
 * the nav describes places you can currently eat, so it has to come from a
 * separate figure written at build time rather than from either length.
 */
let _countsCache = null;
export function loadCounts() {
  if (_countsCache) return _countsCache;
  try {
    _countsCache = JSON.parse(fs.readFileSync(path.resolve("scripts/.data/active-count.json"), "utf-8"));
  } catch {
    _countsCache = { active: 0, archived: 0 };
  }
  return _countsCache;
}
