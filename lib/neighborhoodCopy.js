// Generates neighborhood-page copy that's genuinely differentiated per
// neighborhood (not a mail-merge template with swapped numbers): both the
// FACTS and the SENTENCE STRUCTURE vary based on real, live inspection
// data, so no two neighborhoods produce identical phrasing patterns.
//
// Search-intent grounding (verified via Semrush, July 2026): exact
// health-inspection phrases have near-zero measured national search
// volume ("restaurant health inspection chicago" = 0/mo, "chicago
// restaurant health inspections" = 20/mo) -- people rarely browse this
// topic generically. Generic "[neighborhood] restaurants" volume is huge
// (Wicker Park: 4,400/mo) but dominated by Eater/TimeOut/Yelp-style
// best-of content GutCheck can't out-rank on the head term. The realistic,
// winnable angle is the intersection: "[neighborhood] restaurant health
// inspections / violations / food safety", which is exactly what this
// paragraph targets -- real long-tail phrases, not keyword-stuffed
// boilerplate.

function pct(n) {
  return `${n}%`;
}

export function buildNeighborhoodIntro({ name, stats }) {
  const { total, pass, fail, passRate, vsCitywide, topCategories, recentInspectionCount } = stats;

  // Opening sentence: structure varies by how this neighborhood compares
  // to the citywide average, not just the number plugged in.
  let opening;
  if (vsCitywide >= 5) {
    opening = `${name} restaurants are currently passing Chicago health inspections at a higher rate than the city as a whole: ${pass} of ${total} restaurants on file (${pct(passRate)}) hold a current Pass, running ${pct(Math.abs(vsCitywide))} ahead of Chicago's citywide average.`;
  } else if (vsCitywide <= -5) {
    opening = `Of the ${total} restaurants GutCheck tracks in ${name}, ${pass} (${pct(passRate)}) currently hold a Pass on their most recent Chicago health inspection — running ${pct(Math.abs(vsCitywide))} below the citywide average, worth knowing before you book a table.`;
  } else {
    opening = `${name} has ${total} restaurants on file with the City of Chicago's health inspection program, ${pass} of which (${pct(passRate)}) currently hold a Pass — roughly in line with Chicago's citywide average.`;
  }

  // Violation-pattern sentence: only included when there's real signal,
  // and phrased as an actual finding rather than a generic disclaimer.
  let violationNote = "";
  if (topCategories.length > 0 && fail > 0) {
    const list =
      topCategories.length === 1
        ? topCategories[0]
        : topCategories.length === 2
        ? `${topCategories[0]} and ${topCategories[1]}`
        : `${topCategories.slice(0, -1).join(", ")}, and ${topCategories[topCategories.length - 1]}`;
    violationNote = ` Among ${name} restaurants with recent violations, ${list} come up most often in inspector notes — the same categories the City of Chicago's Food Protection Program flags as Priority and Priority Foundation issues.`;
  }

  // Recency sentence: reinforces the "live data" differentiator, which is
  // the one thing static best-of lists structurally can't offer.
  const recency =
    recentInspectionCount > 0
      ? ` GutCheck logged ${recentInspectionCount} new ${name} inspection${recentInspectionCount === 1 ? "" : "s"} in the most recent 30-day window covered by the city's feed — every listing below reflects each restaurant's current, not historical, status.`
      : ` Every listing below reflects each restaurant's current inspection status, pulled directly from the City of Chicago's live feed.`;

  return opening + violationNote + recency;
}

export function buildNeighborhoodFaqCopy({ name, stats }) {
  const { total, fail } = stats;
  return [
    {
      q: `How many restaurants in ${name} have failed a Chicago health inspection?`,
      a: `${fail} of the ${total} restaurants GutCheck currently tracks in ${name} hold a Fail on their most recent Chicago Department of Public Health inspection. This changes as new inspections come in — GutCheck rebuilds from the city's live feed on every deploy, so this reflects current status, not a historical snapshot.`,
    },
    {
      q: `Is GutCheck's ${name} restaurant health data official?`,
      a: `Yes. Every record comes directly from the City of Chicago's public Food Inspections open-data feed (data.cityofchicago.org, dataset 4ijn-s7e5) — the same data the Chicago Department of Public Health publishes itself. GutCheck is an independent service and isn't affiliated with the City of Chicago.`,
    },
  ];
}
