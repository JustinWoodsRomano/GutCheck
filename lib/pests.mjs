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
const MOLD = /\bmold(?:y|ed)?\b|\bmildew\b/i;
const SEWAGE = /\bsewage\b|\bsewer\b|\bsewage\s+backup\b|\bback[\s-]?flow\b/i;

const PEST_TAGS = [
  { key: "roach", emoji: "🪳", label: "Roaches", re: ROACH, gated: true },
  { key: "rodent", emoji: "🐀", label: "Mice / rats", re: RODENT, gated: true },
  { key: "fly", emoji: "🪰", label: "Flies / gnats", re: FLY, gated: true },
  { key: "droppings", emoji: "💩", label: "Droppings", re: DROPPINGS, gated: false },
  { key: "mold", emoji: "🦠", label: "Mold", re: MOLD, gated: false },
  { key: "sewage", emoji: "🚽", label: "Sewage", re: SEWAGE, gated: false },
];

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
  { re: /license/i, label: "New license", tone: "neutral" },
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
