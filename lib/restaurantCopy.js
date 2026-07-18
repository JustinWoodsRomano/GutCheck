// Auto-generated per-restaurant FAQ content. This targets the search
// pattern the keyword research actually supports: people don't browse
// generic "restaurant health inspection" queries (near-zero volume), they
// search a SPECIFIC restaurant's name plus "inspection" / "health" /
// "violations" when they already have a reason to look -- and for that
// intersection, GutCheck's per-restaurant pages have essentially zero
// competing content. Every answer is built from this restaurant's own
// live data field, never templated boilerplate with no real information.

import { GRADE_LABEL } from "./constants";

export function buildRestaurantFaq(r) {
  const gradeLabel = GRADE_LABEL[r.g];
  const verb = gradeLabel === "Fail" ? "failed" : gradeLabel === "Pass" ? "passed" : "received a Pass w/ Conditions on";

  const items = [
    {
      q: `Has ${r.n} passed its most recent Chicago health inspection?`,
      a: `${r.n} ${verb} its most recent City of Chicago health inspection, conducted on ${r.d}. This reflects the restaurant's current status as tracked by the Chicago Department of Public Health -- GutCheck rebuilds this page from the city's live data feed, so it updates automatically as new inspections are recorded.`,
    },
  ];

  if (r.v.length > 0) {
    const critical = r.v.filter((v) => v.s === "c").length;
    items.push({
      q: `What violations did ${r.n} have at its last health inspection?`,
      a: `Inspectors recorded ${r.v.length} violation${r.v.length === 1 ? "" : "s"} at ${r.n}'s most recent inspection on ${r.d}${critical > 0 ? `, including ${critical} classified as Priority or Priority Foundation` : ""}. Full violation text is listed on this page below.`,
    });
  } else if (r.g === "PASS") {
    items.push({
      q: `What violations did ${r.n} have at its last health inspection?`,
      a: `No violations were recorded at ${r.n}'s most recent City of Chicago health inspection on ${r.d}.`,
    });
  } else {
    items.push({
      q: `What violations did ${r.n} have at its last health inspection?`,
      a: `${r.n}'s most recent City of Chicago health inspection on ${r.d} resulted in a ${gradeLabel} grade, but the city's public dataset doesn't include itemized violation text for this specific inspection. GutCheck displays exactly what the city publishes and doesn't infer violation details that aren't in the official record.`,
    });
  }

  items.push({
    q: `When was ${r.n} last inspected by the City of Chicago?`,
    a: `${r.n} was last inspected on ${r.d}. GutCheck's data is sourced directly from the City of Chicago's public Food Inspections feed and rebuilt on every deploy, so this date reflects the most recent inspection on file at the time you're viewing this page.`,
  });

  return items;
}
