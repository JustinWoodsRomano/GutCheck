// Official City of Chicago community-area assignment.
//
// Why this exists: neighborhoods used to be derived purely from ZIP code
// (lib/zipNeighborhoods.mjs), which was both incomplete and frequently
// wrong. Chicago ZIPs don't nest inside the 77 community areas -- verified
// against live data, only 17 of 117 restaurants in the "Portage Park" ZIP
// bucket actually sit inside Portage Park, and 78 of 103 in the "East
// Garfield Park" bucket are really in Near West Side.
//
// Every inspection record carries latitude/longitude, so we can place each
// establishment inside the city's own published boundary polygons instead
// of guessing from ZIP. Boundaries come from the Chicago data portal
// dataset igwz-8jzy, simplified to ~13m precision (99.94% identical
// assignment vs full precision, at a third of the bytes).
//
// IMPORTANT: this does NOT replace the vernacular neighborhood names. Those
// are what people actually search for -- "west loop restaurants" gets 9,900
// searches/mo while "near west side chicago restaurants" gets 0. Vernacular
// names stay primary; community areas are an additional, complementary
// layer that fills in the 40 areas vernacular ZIP mapping never covered.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const caches = {};

function loadPolygonSet(filename) {
  if (caches[filename]) return caches[filename];
  const file = path.join(__dirname, filename);
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  caches[filename] = raw.map((a) => {
    const xs = [];
    const ys = [];
    for (const poly of a.p) {
      for (const pt of poly[0]) {
        xs.push(pt[0]);
        ys.push(pt[1]);
      }
    }
    return {
      name: a.n,
      slug: a.s,
      polys: a.p,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  });
  return caches[filename];
}

const loadAreas = () => loadPolygonSet("communityAreas.json");
const loadNeighborhoodPolys = () => loadPolygonSet("neighborhoodPolygons.json");

function locateIn(areas, lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const a of areas) {
    const [x0, y0, x1, y1] = a.bbox;
    // Cheap bbox reject first -- avoids running point-in-polygon against
    // every area for each of 8,000+ records.
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
    for (const poly of a.polys) {
      if (pointInPolygon(lon, lat, poly)) return { name: a.name, slug: a.slug };
    }
  }
  return null;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(x, y, poly) {
  // poly[0] is the outer ring; any further rings are holes.
  if (!pointInRing(x, y, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (pointInRing(x, y, poly[i])) return false;
  }
  return true;
}

/**
 * Resolve a coordinate to its official community area.
 * Returns { name, slug } or null when the point falls outside the city
 * (a handful of records sit just past the boundary, plus ~9 with no
 * coordinates at all).
 */
export function communityAreaFor(lat, lon) {
  return locateIn(loadAreas(), lat, lon);
}

export function allCommunityAreas() {
  return loadAreas().map(({ name, slug }) => ({ name, slug }));
}

/**
 * Resolve a coordinate to its vernacular neighborhood -- the names people
 * actually use and search for (Bucktown, Andersonville, Wrigleyville),
 * which the 77 community areas don't capture. Boundaries come from the
 * city's own Neighborhoods dataset (y6yq-dbs2).
 *
 * This matters commercially, not just cosmetically: "andersonville
 * restaurants" draws 2,400 searches/mo and "bucktown restaurants" 1,000,
 * while the community area containing them ("Lincoln Square", "Logan
 * Square") captures none of that intent.
 */
export function vernacularNeighborhoodFor(lat, lon) {
  return locateIn(loadNeighborhoodPolys(), lat, lon);
}

export function allVernacularNeighborhoods() {
  return loadNeighborhoodPolys().map(({ name, slug }) => ({ name, slug }));
}

/**
 * Legacy ZIP-era neighborhood slugs that have no polygon of the same name.
 * Each maps to the polygon slug(s) that actually cover that area, so the
 * URLs keep working AND finally list the right restaurants.
 *
 * These are kept rather than redirected because several carry far more
 * search demand than the official name for the same ground: "pilsen
 * restaurants" is 1,300/mo, "lower west side chicago restaurants" is 20.
 */
export const NEIGHBORHOOD_ALIASES = {
  pilsen: { name: "Pilsen", covers: ["lower-west-side"] },
  lakeview: { name: "Lakeview", covers: ["lake-view"] },
  "west-rogers-park": { name: "West Rogers Park", covers: ["west-ridge"] },
  "back-of-the-yards": { name: "Back of the Yards", covers: ["new-city"] },
  "noble-square": { name: "Noble Square", covers: ["east-village", "west-town"] },
  // Bronzeville spans two community areas; both are included deliberately.
  bronzeville: { name: "Bronzeville", covers: ["grand-boulevard", "douglas"] },
  "south-loop": { name: "South Loop", covers: ["printers-row", "near-south-side"] },
};
