/**
 * Flags the pest a violation actually mentions, so someone scanning a long
 * inspection report can pick out the findings that matter to them without
 * reading every line.
 *
 * Matching runs against the inspector's comment text -- the free-text part
 * after "Comments:" -- not the violation title. That distinction matters:
 * violation #38 is titled "INSECTS, RODENTS, & ANIMALS NOT PRESENT" and is
 * attached to plenty of reports where nothing was found, so keying off the
 * title would tag clean records.
 *
 * Patterns were checked against 16,814 real comment blocks from 2025-present.
 */

// \b before the optional "cock" keeps "approach" from matching "roach".
const ROACH = /\b(?:cock)?roach(?:es)?\b/i;

const FLY = /\b(?:flies|fly|gnat|gnats|fruit\s+fl(?:y|ies))\b/i;

// Deliberately excludes a bare "droppings": of 227 blocks containing the
// word, 210 already name a rodent and the rest include pigeon droppings,
// so matching it alone would mislabel more than it caught.
const RODENT = /\b(?:mice|mouse|rat|rats|rodent|rodents|vermin)\b/i;

export const PESTS = [
  { key: "roach", emoji: "🪳", label: "Roaches", re: ROACH },
  { key: "fly", emoji: "🪰", label: "Flies / gnats", re: FLY },
  { key: "rodent", emoji: "🐀", label: "Mice / rats", re: RODENT },
];

/**
 * Returns the pest tags present in a violation's text.
 * A violation can carry more than one -- reports citing both roaches and
 * mice in the same finding are common.
 */
export function detectPests(text) {
  if (!text || typeof text !== "string") return [];
  return PESTS.filter((p) => p.re.test(text)).map(({ key, emoji, label }) => ({
    key,
    emoji,
    label,
  }));
}
