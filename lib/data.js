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
