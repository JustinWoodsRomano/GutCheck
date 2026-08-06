/**
 * Helpers shared by the violations index and the per-code pages.
 *
 * Kept in .mjs so scripts/fetch-data.mjs can import the same slug function the
 * pages use -- if the sitemap and the routes disagreed on a slug, every
 * violation page would be listed at a URL that 404s.
 */

/** URL slug for a violation, e.g. { code: 38, title: "Insects, Rodents..." } -> "38-insects-rodents-animals-not-present" */
export function violationSlug(v) {
  const words = v.title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 7)
    .join("-");
  return `${v.code}-${words}`;
}

/**
 * Chicago's three severity tiers, by code range.
 *
 * The city's inspection form groups items into these bands: priority items
 * first, then priority foundation, then core. The published dataset carries no
 * severity field, so the band is inferred from the code number -- which is how
 * the form itself is ordered. Stated as an inference on the pages rather than
 * presented as a published fact.
 */
export function severityOf(code) {
  if (code <= 29) return { key: "priority", label: "Priority" };
  if (code <= 44) return { key: "foundation", label: "Priority foundation" };
  return { key: "core", label: "Core" };
}

/** Plain-language description of what a tier means. */
export function severityBlurb(key) {
  if (key === "priority")
    return "Priority violations address the most direct routes to foodborne illness — temperature control, contamination, sick employees, unsafe sourcing. A single one can fail an inspection on its own.";
  if (key === "foundation")
    return "Priority foundation violations cover the procedures, equipment and training that make food safety controls possible — the things that have to be in place for a priority item to be met.";
  return "Core violations concern facility maintenance, cleanliness and paperwork. They rarely fail an inspection on their own, and they are by far the most commonly cited.";
}
