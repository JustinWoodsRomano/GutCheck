// Generates neighborhood-page copy that's genuinely differentiated per
// neighborhood (not a mail-merge template with swapped numbers): both the
// FACTS and the SENTENCE STRUCTURE vary based on real, live inspection
// data, so no two neighborhoods produce identical phrasing patterns.
//
// Search-intent grounding (Semrush, Aug 2026). Two findings drive this:
//
//  1. Generic inspection phrasing has ~zero volume ("restaurant inspection
//     chicago" = 0/mo, "restaurant violations chicago" = 0/mo). Nobody
//     browses this topic in the abstract.
//  2. But the *question* form has real volume: "where can i find restaurant
//     health inspection reports" = 1,600/mo (KD 39), "how to look up
//     restaurant health inspections" = 140/mo, "how often do health
//     inspectors inspect restaurants" = 40/mo, "are restaurant health
//     inspections public" = 20/mo, "what happens if a restaurant fails a
//     health inspection" = 20/mo.
//
// So the FAQ answers the questions people demonstrably ask, scoped to the
// neighborhood -- rather than the site-centric questions the previous
// version asked ("Is GutCheck's data official?"), which nobody searches.
//
// Deliberately kept to a small set of genuinely useful answers. Google's
// generative-AI guidance explicitly warns that spinning up content for
// every query variation is scaled content abuse, and that a high quantity
// of pages doesn't make a site more relevant. These earn their place by
// answering with this neighborhood's real numbers, which is information
// that exists nowhere else.

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
  const { total, pass, conditional, fail } = stats;

  const items = [
    {
      // Targets "where can i find restaurant health inspection reports"
      // (1,600/mo) and "how to look up restaurant health inspections"
      // (140/mo), scoped to this neighborhood.
      q: `How do I look up a restaurant's health inspection score in ${name}?`,
      a: `Search any ${name} restaurant or bar by name in the search box on this page, or browse the full list below. Each listing opens a page showing that restaurant's most recent City of Chicago inspection result, the specific violations inspectors cited, and its full inspection history. All ${total} ${name} establishments on this page come from the City of Chicago's public Food Inspections dataset, which GutCheck rebuilds daily.`,
    },
    {
      // Targets "what restaurants failed health inspections near me" and
      // the neighborhood-scoped version of the same intent.
      q: `Which restaurants in ${name} failed their health inspection?`,
      a:
        fail > 0
          ? `${fail} of the ${total} restaurants currently tracked in ${name} hold a Fail on their most recent inspection, and ${conditional} more passed only with conditions. Use the Failing filter above the list to see them. A Fail means inspectors found violations serious enough that the establishment could not continue operating until they were corrected — most are re-inspected and reopen within days.`
          : `No ${name} restaurants currently hold a Fail on their most recent City of Chicago inspection. ${conditional} passed with conditions, meaning inspectors cited violations that had to be corrected but weren't severe enough to halt operation. This reflects current status and changes as new inspections are published.`,
    },
    {
      // "what happens if a restaurant fails a health inspection" (20/mo)
      // plus the single most common point of confusion in this dataset.
      q: `What does "Pass with Conditions" mean on a Chicago health inspection?`,
      a: `It means the restaurant passed, but inspectors cited violations that needed correcting — often on the spot, during the inspection itself. It is not a failure and does not stop a restaurant from operating. In ${name}, ${conditional} of ${total} establishments currently carry this result, compared with ${pass} holding a clean Pass. Because roughly one in five Chicago establishments carries it at any given time, treating it as equivalent to a Fail would be misleading.`,
    },
    {
      // "how often do health inspectors inspect restaurants" (40/mo) and
      // "are restaurant health inspections public" (20/mo).
      q: `How often does Chicago inspect restaurants in ${name}, and are the results public?`,
      a: `The Chicago Department of Public Health inspects food establishments on a risk-based schedule — higher-risk operations more frequently — plus complaint-driven and re-inspection visits, so the gap between inspections varies by restaurant rather than following a fixed calendar. Every result is public record, published through the city's open-data portal (dataset 4ijn-s7e5). GutCheck reads that same feed directly; it's an independent service and isn't affiliated with the City of Chicago.`,
    },
  ];

  return items;
}
