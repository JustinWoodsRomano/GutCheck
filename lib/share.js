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
