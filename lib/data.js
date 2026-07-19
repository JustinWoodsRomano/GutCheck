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

export function loadNeighborhoods() {
  const restaurants = loadRestaurants();
  const map = new Map();
  for (const r of restaurants) {
    if (!map.has(r.nbSlug)) map.set(r.nbSlug, r.nb);
  }
  return [...map.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
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
