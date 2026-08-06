/**
 * Flags what a violation actually describes, so a long inspection report can
 * be scanned for the findings that matter without reading every line.
 *
 * Two rules shape this, both learned from real data rather than assumed:
 *
 * 1. Matching runs on the inspector's comment text, never the violation
 *    title. Violation #38 is titled "INSECTS, RODENTS, & ANIMALS NOT
 *    PRESENT" and is attached to plenty of reports where nothing was found,
 *    so keying off titles would tag clean records.
 *
 * 2. A pest is only tagged when something was actually observed. Chicago
 *    inspectors write up structural findings using the same nouns -- "rear
 *    exit door not rodent proof", "remove clutter to prevent rodent
 *    harborage" -- where no rodent was seen at all. Tagging those implies an
 *    infestation that the report doesn't claim. Across 35,435 comment blocks
 *    from mid-2025 on, naive noun matching tagged 851 blocks as rodents;
 *    requiring evidence brings that to 559, cutting ~290 findings that were
 *    really about door gaps and housekeeping.
 */

// Structural / preventive phrasing. Scrubbed out before pest matching so the
// nouns inside it can't trigger a tag.
const PREVENTIVE =
  /(?:rodent|pest|insect|vermin)[\s-]*proof\w*|prevent\w*[^.]{0,40}?(?:rodent|pest|insect|vermin|entry)|(?:rodent|pest|insect)[\s-]*(?:entry|harborage|control\s+(?:service|report|log|contract|company))|entry\s+point\w*|(?:eliminate|deter)[^.]{0,30}?(?:rodent|pest)/gi;

// Something was seen, counted, or documented -- as opposed to a condition
// that might attract pests later. A bare number counts: inspectors write
// "observed 30 live roaches" but also "30 mouse droppings on floor".
const EVIDENCE = /\b(?:observed|found|noted|evidence of|presence of|sighting|live|dead|\d+)\b/i;

// \b before the optional "cock" keeps "approach" from matching "roach".
const ROACH = /\b(?:cock)?roach(?:es)?\b/i;
const FLY = /\b(?:flies|fly|gnat|gnats|fruit\s+fl(?:y|ies))\b/i;
const RODENT = /\b(?:mice|mouse|rat|rats|rodent|rodents|vermin)\b/i;

// These three don't need the evidence gate: there's no preventive way to
// mention them. "Mold" in an inspection comment means mold was there.
const DROPPINGS = /\bdroppings?\b/i;
// Covers mould and the biofilm inspectors describe as "black slime" or a
// "pink substance", usually inside ice machines and soda guns. Same category
// of microbial growth, and it more than doubles what this tag catches
// (167 -> 353 blocks) without matching black pepper or pink butcher paper.
const MOLD =
  /\bmold(?:y|ed)?\b|\bmildew\b|\bslime\b|\bslimy\b|\bbiofilm\b|\bblack\s+(?:residue|substance|build[- ]?up)\b|\bpink\s+(?:residue|substance|slime)\b/i;
const SEWAGE = /\bsewage\b|\bsewer\b|\bsewage\s+backup\b|\bback[\s-]?flow\b/i;

// Food stored next to garbage, dumpsters, or waste. A distinct kind of gross
// from pests: nothing is living in the kitchen, but the storage itself is the
// hazard, and it's the sort of thing a reader wants flagged.
// Requires explicit proximity language rather than the two nouns merely
// co-occurring. A loose version matched ceiling leaks and missing prep sinks
// (108 hits, mostly wrong); this one matches 5 in 18,344 comment blocks and
// they are genuinely "food beside the garbage". Rare, but right when it fires.
const REFUSE =
  /(?:food|produce|prep(?:aration)? (?:table|area|sink)|utensils?|dishes|ice(?: machine)?|single[- ]use)[^.]{0,40}?(?:next to|near|adjacent to|beside|directly (?:above|over|under|below)|above|over|under|stored (?:in|on|by|near))[^.]{0,25}?(?:garbage|refuse|trash|dumpster)|(?:garbage|refuse|trash|dumpster)[^.]{0,40}?(?:next to|near|adjacent to|beside|directly (?:above|over|under|below)|above|over|under|stored (?:in|on|by|near))[^.]{0,25}?(?:food|produce|prep(?:aration)? (?:table|area|sink)|utensils?|dishes|ice(?: machine)?|single[- ]use)/i;

const PEST_TAGS = [
  { key: "roach", emoji: "🪳", label: "Roaches", re: ROACH, gated: true },
  { key: "rodent", emoji: "🐀", label: "Mice / rats", re: RODENT, gated: true },
  { key: "fly", emoji: "🪰", label: "Flies / gnats", re: FLY, gated: true },
  { key: "droppings", emoji: "💩", label: "Droppings", re: DROPPINGS, gated: false },
  { key: "mold", emoji: "🦠", label: "Mold / slime", re: MOLD, gated: false },
  { key: "sewage", emoji: "🚽", label: "Sewage", re: SEWAGE, gated: false },
  { key: "refuse", emoji: "🗑️", label: "Food near waste", re: REFUSE, gated: false },
];

/**
 * Orders a violation list so priority findings come first.
 *
 * Chicago returns violations in code order, which buries the serious ones:
 * a priority violation numbered 55 lands below a core violation numbered 3.
 * Someone scanning a 16-violation report should hit what matters first.
 * Within each severity band the city's own ordering is preserved, so nothing
 * is reshuffled beyond the promotion.
 */
export function sortViolations(violations) {
  if (!Array.isArray(violations)) return [];
  return violations
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const aCrit = a.v.s === "c" ? 0 : 1;
      const bCrit = b.v.s === "c" ? 0 : 1;
      if (aCrit !== bCrit) return aCrit - bCrit;
      return a.i - b.i;
    })
    .map(({ v }) => v);
}

export const PESTS = PEST_TAGS.map(({ key, emoji, label }) => ({ key, emoji, label }));

/**
 * Returns the tags a violation's text earns. A violation can carry several --
 * findings that cite both roaches and mouse droppings are common.
 */
export function detectPests(text) {
  if (!text || typeof text !== "string") return [];

  // Neutralise preventive phrasing, then decide whether what's left
  // describes an observation.
  const scrubbed = text.replace(PREVENTIVE, " ");
  const hasEvidence = EVIDENCE.test(scrubbed);

  return PEST_TAGS.filter((t) => {
    if (t.gated) return t.re.test(scrubbed) && hasEvidence;
    return t.re.test(text);
  }).map(({ key, emoji, label }) => ({ key, emoji, label }));
}

/**
 * Why an inspection happened. The city's raw values are inconsistent in
 * casing and a few are opaque ("Canvass" means a routine unannounced visit),
 * so they're normalised into something a reader can act on.
 *
 * This matters more than it looks: complaint-driven inspections fail at 34%
 * against 22% for routine ones, so knowing an inspection was triggered by a
 * member of the public is real signal about the finding.
 */
const INSPECTION_REASONS = [
  { re: /suspected food poisoning re-?inspection/i, label: "Food poisoning re-inspection", tone: "alarm" },
  { re: /suspected food poisoning/i, label: "Suspected food poisoning", tone: "alarm" },
  { re: /short form complaint/i, label: "Complaint", tone: "flag" },
  { re: /complaint re-?inspection/i, label: "Complaint re-inspection", tone: "flag" },
  { re: /complaint/i, label: "Customer complaint", tone: "flag" },
  { re: /canvass re-?inspection/i, label: "Re-inspection", tone: "neutral" },
  { re: /license re-?inspection/i, label: "License re-inspection", tone: "neutral" },
  { re: /license.*task force|task force/i, label: "Task force", tone: "neutral" },
  // "new", not "neutral": RestaurantCard renders this same label green via
  // isNewLicense(), so leaving it neutral here meant one label with two
  // colours depending on which component drew it.
  { re: /license/i, label: "New license", tone: "new" },
  { re: /canvass/i, label: "Routine inspection", tone: "neutral" },
  { re: /tag removal/i, label: "Tag removal", tone: "neutral" },
  { re: /consultation/i, label: "Consultation", tone: "neutral" },
  { re: /recent inspection/i, label: "Recent inspection", tone: "neutral" },
  { re: /out of business/i, label: "Out of business check", tone: "neutral" },
];

export function inspectionReason(rawType) {
  if (!rawType || typeof rawType !== "string") return null;
  const hit = INSPECTION_REASONS.find((r) => r.re.test(rawType));
  if (!hit) return null;
  return { label: hit.label, tone: hit.tone };
}


// How long a licence inspection keeps counting as "new".
//
// 90 days rather than 60. Checked against the live data: 60 days covers 122
// establishments across 54 neighbourhoods, 90 covers 171 across 66 -- 40%
// more listings and, more usefully, twelve more neighbourhoods, which is what
// the "new {neighbourhood} restaurants" long tail needs. The slowest month on
// record filed 29 licence inspections, so even a bad quarter leaves ~105
// places; the list never looks empty. It is still conservative next to how
// the term is used in practice -- Eater and Infatuation "new restaurant"
// round-ups routinely cover six to twelve months of openings.
export const NEW_LICENCE_DAYS = 90;

/**
 * Was this establishment licensed recently enough to still count as new?
 *
 * `it` is the reason for the most recent inspection, so a "License" value
 * means the newest thing in the city's record for this place is a licence
 * check -- it has not had a routine inspection since.
 */
export function isNewLicense(it, d, days = NEW_LICENCE_DAYS) {
  if (it !== "License" || !d) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff.toISOString().slice(0, 10);
}

// How long a closure stays on the recent-closures page.
export const RECENT_CLOSURE_DAYS = 90;

/**
 * Was this licence marked out of business recently enough to still be news?
 *
 * Note this describes the RECORD, not the business: the city logs that an
 * inspector found the establishment gone. It publishes no reason, and a
 * licence can be reinstated.
 */
export function isRecentClosure(d, days = RECENT_CLOSURE_DAYS) {
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff.toISOString().slice(0, 10);
}
