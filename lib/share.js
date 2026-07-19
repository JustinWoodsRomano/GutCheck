// Grade-specific share copy. Always reflects the restaurant's CURRENT
// (most recent) inspection result, since it's generated from live `r.g`
// data at render time, not cached or hardcoded.

export function getShareMessage(restaurant) {
  const { n: name, g: grade } = restaurant;
  switch (grade) {
    case "PASS":
      return `\u2705 ${name} just passed its Chicago health inspection \uD83D\uDE42 \u2014 check any Chicago restaurant on GutCheck.`;
    case "CONDITIONAL":
      return `\uD83D\uDE2C ${name} passed its latest Chicago health inspection, but with conditions attached \u2014 see exactly what inspectors flagged on GutCheck.`;
    case "FAIL":
      return `\uD83E\uDD22 ${name} just FAILED its Chicago health inspection. Here's exactly what inspectors found \u2014 GutCheck.`;
    default:
      return `${name} on GutCheck Chicago \u2014 official health inspection records.`;
  }
}

export function getViolationShareMessage(restaurant, violation) {
  const label = violation?.s === "c" ? "priority violation" : "violation";
  return `\uD83D\uDEA8 ${restaurant.n} was cited for a ${label} at its last Chicago health inspection: "${violation.t}" \u2014 GutCheck.`;
}

// Used on the Hall of Shame page, where the restaurant's identity is kept
// hidden. Deliberately factual and neutral -- states the violation and
// points to the official record, with no gamified "guess which one"
// framing and no editorializing about the restaurant.
export function getAnonymizedViolationShareMessage(violation) {
  const label = violation?.s === "c" ? "priority violation" : "violation";
  return `\uD83D\uDEA8 A Chicago restaurant was cited for a ${label} at its most recent health inspection: "${violation.t}" \u2014 GutCheck Chicago, official public health inspection records.`;
}
