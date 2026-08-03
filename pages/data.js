import Head from "next/head";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import AdSlot from "../components/AdSlot";
import { loadRestaurants } from "../lib/data";
import analysis from "../data/inspection-analysis.json";

const SITE = "https://www.gutcheckchicago.com";

export async function getStaticProps() {
  return { props: { total: loadRestaurants().length } };
}

function titleCase(s) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 || w === "&" ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function DataPage({ total }) {
  const { meta, seasonality, yearly, mostCited, mostPredictive, byInspectionType, repeat } = analysis;

  const title = "What 16 Years of Chicago Restaurant Inspections Actually Show | GutCheck";
  const description = `An analysis of ${meta.gradedInspections.toLocaleString()} Chicago restaurant and bar health inspections: which violations inspectors cite most, which ones actually predict a failure, and why the two lists are almost opposites.`;
  const url = `${SITE}/data`;

  const routine = byInspectionType.find((t) => t.type === "canvass");
  const complaint = byInspectionType.find((t) => t.type === "complaint");
  const reinspection = byInspectionType.find((t) => t.type === "canvass re-inspection");
  const topCited = mostCited[0];
  const rodents = mostCited.find((v) => v.code === 38) || mostPredictive.find((v) => v.code === 38);
  const peakYear = yearly.reduce((a, b) => (b.failRate > a.failRate ? b : a));
  const latestYear = yearly[yearly.length - 1];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GutCheck Chicago", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Inspection data analysis", item: url },
    ],
  };

  // Dataset + Article markup. Google's own guidance is that structured data
  // isn't required for generative AI features, but it remains worthwhile for
  // rich results -- and this page is genuinely a derived dataset, so the
  // markup is descriptive rather than decorative.
  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Chicago restaurant health inspection outcomes, 2010–present",
    description,
    url,
    creator: { "@type": "Organization", name: "GutCheck Chicago", url: SITE },
    isBasedOn: "https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5",
    license: "https://www.cityofchicago.org/city/en/narr/foia/data_disclaimer.html",
    temporalCoverage: `${meta.earliest}/${meta.latest}`,
    dateModified: meta.generated,
    variableMeasured: [
      "Inspection result (Pass, Pass w/ Conditions, Fail)",
      "Violation code citation frequency",
      "Inspection type",
      "Establishment risk tier",
    ],
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "What 16 years of Chicago restaurant inspections actually show",
    description,
    datePublished: meta.generated,
    dateModified: meta.generated,
    author: { "@type": "Organization", name: "GutCheck Chicago", url: SITE },
    publisher: { "@type": "Organization", name: "GutCheck Chicago", url: SITE },
    mainEntityOfPage: url,
  };

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      </Head>

      <Nav total={total} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">GutCheck Chicago</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">Inspection data analysis</span>
      </nav>

      <div className="wrap hero">
        <div className="eyebrow">
          Original analysis · {meta.gradedInspections.toLocaleString()} inspections · {meta.earliest} to {meta.latest}
        </div>
        <h1>WHAT 16 YEARS OF CHICAGO INSPECTIONS ACTUALLY SHOW</h1>
        <p>
          Chicago has published every restaurant health inspection as open data since 2010. That&rsquo;s{" "}
          {meta.totalInspectionsInDataset.toLocaleString()} inspections, of which{" "}
          {meta.restaurantBarInspections.toLocaleString()} cover restaurants and bars. We analyzed the{" "}
          {meta.gradedInspections.toLocaleString()} that produced an actual pass/fail judgment. The most
          interesting finding is that the violations inspectors write up most often are almost the
          opposite of the ones that actually mean something.
        </p>
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />

        {/* ---- Finding 1 ---- */}
        <section className="finding">
          <h2>The most-cited violation is one of the least serious</h2>
          <p>
            <strong>{titleCase(topCited.title)}</strong> (violation #{topCited.code}) appears on{" "}
            <strong>{topCited.shareOfInspections}%</strong> of restaurant inspections that carry any
            violation at all &mdash; nearly double the next most common. It is, by a wide margin, the
            single most written-up item in Chicago.
          </p>
          <p>
            It is also barely predictive of anything. When inspectors cite it, the inspection fails{" "}
            {topCited.failRate}% of the time &mdash; only {topCited.lift}× the baseline failure rate of{" "}
            {analysis.violationBaseFailRate}% among inspections with violations. In other words, seeing
            it on a report tells you almost nothing you didn&rsquo;t already know.
          </p>
          <p>
            This matters because it&rsquo;s the violation you are most likely to encounter when you look
            up a restaurant. A report showing &ldquo;physical facilities&rdquo; issues is closer to
            routine than alarming.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <caption>Most-cited violations, {meta.violationWindowStart.slice(0, 4)}&ndash;present</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Violation</th>
                  <th scope="col">Share of inspections</th>
                  <th scope="col">Fail rate when cited</th>
                </tr>
              </thead>
              <tbody>
                {mostCited.slice(0, 8).map((v) => (
                  <tr key={v.code}>
                    <td>{v.code}</td>
                    <td>{titleCase(v.title)}</td>
                    <td>{v.shareOfInspections}%</td>
                    <td>{v.failRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Finding 2 ---- */}
        <section className="finding">
          <h2>The violations that actually predict a failure are far rarer</h2>
          <p>
            Ranking violations by how often they coincide with an outright Fail produces a nearly
            inverted list. Two of the top three aren&rsquo;t food-safety findings at all &mdash;
            they&rsquo;re records that a <em>previous</em> violation went uncorrected, which is the
            clearest signal in the entire dataset.
          </p>
          <p>
            The most useful one for an ordinary diner is #{rodents?.code ?? 38}:{" "}
            <strong>{titleCase(rodents?.title ?? "Insects, Rodents, & Animals Not Present")}</strong>.
            It was cited on {(rodents?.count ?? 0).toLocaleString()} inspections and coincides with a
            failure {rodents?.failRate}% of the time &mdash; {rodents?.lift}× baseline. Unlike the
            paperwork violations above it, this one is common enough to actually show up in a search
            and serious enough to mean something.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <caption>Violations most associated with a failed inspection (cited 800+ times)</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Violation</th>
                  <th scope="col">Times cited</th>
                  <th scope="col">Fail rate</th>
                  <th scope="col">vs. baseline</th>
                </tr>
              </thead>
              <tbody>
                {mostPredictive.map((v) => (
                  <tr key={v.code}>
                    <td>{v.code}</td>
                    <td>{titleCase(v.title)}</td>
                    <td>{v.count.toLocaleString()}</td>
                    <td>{v.failRate}%</td>
                    <td>{v.lift}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Finding 3 ---- */}
        <section className="finding">
          <h2>Failure is concentrated in a small group of repeat offenders</h2>
          <p>
            Across {repeat.establishments.toLocaleString()} establishments with at least one graded
            inspection, {repeat.everFailed.toLocaleString()} have failed at least once. But{" "}
            <strong>{repeat.failed3Plus.toLocaleString()} establishments</strong> &mdash; those that have
            failed three or more times &mdash; account for{" "}
            <strong>{repeat.shareOfFailuresFrom3Plus}% of all {repeat.totalFailureEvents.toLocaleString()}{" "}
            failure events</strong> in the city&rsquo;s history.
          </p>
          <p>
            A single failure is common and usually temporary. A pattern of them is not, and it&rsquo;s
            the thing worth looking for in a restaurant&rsquo;s inspection history rather than its most
            recent result alone.
          </p>
        </section>

        {/* ---- Finding 4 ---- */}
        <section className="finding">
          <h2>Complaints find roughly {Math.round((complaint.failRate / routine.failRate - 1) * 100)}% more problems than routine visits</h2>
          <p>
            Routine canvass inspections fail {routine.failRate}% of the time. Inspections triggered by a
            public complaint fail {complaint.failRate}% of the time &mdash; a substantially higher rate,
            across {complaint.n.toLocaleString()} complaint inspections. People who report restaurants are
            frequently right.
          </p>
          <p>
            Re-inspections tell the opposite story: {reinspection.passRate}% pass. Whatever failed the
            first time usually gets fixed, and fast. That&rsquo;s the strongest argument against reading a
            single historical Fail as a permanent verdict.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <caption>Outcome by inspection type</caption>
              <thead>
                <tr>
                  <th scope="col">Inspection type</th>
                  <th scope="col">Count</th>
                  <th scope="col">Pass</th>
                  <th scope="col">Fail</th>
                </tr>
              </thead>
              <tbody>
                {byInspectionType.map((t) => (
                  <tr key={t.type}>
                    <td>{titleCase(t.type)}</td>
                    <td>{t.n.toLocaleString()}</td>
                    <td>{t.passRate}%</td>
                    <td>{t.failRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Finding 5 ---- */}
        <section className="finding">
          <h2>{seasonality.worst.month} is the worst month to be inspected. {seasonality.best.month} is the best.</h2>
          <p>
            Across all {meta.gradedInspections.toLocaleString()} graded inspections,{" "}
            {seasonality.worst.month} carries a {seasonality.worst.failRate}% failure rate and{" "}
            {seasonality.best.month} a {seasonality.best.failRate}% one &mdash; a{" "}
            {seasonality.relativeGapPct}% relative difference. The warm-weather months from June through
            October sit consistently above the winter ones, which is what you&rsquo;d expect if
            temperature control and pest pressure drive a meaningful share of violations.
          </p>
          <p className="hint">
            A caution on this figure: it describes when inspections are <em>failed</em>, not necessarily
            when restaurants are dirtiest. Inspection volume and mix also shift seasonally.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <caption>Failure rate by month, all years combined</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Inspections</th>
                  <th scope="col">Fail rate</th>
                </tr>
              </thead>
              <tbody>
                {seasonality.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>{m.n.toLocaleString()}</td>
                    <td>{m.failRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Finding 6 ---- */}
        <section className="finding">
          <h2>Failure rates peaked in {peakYear.year} and have fallen since</h2>
          <p>
            The citywide failure rate climbed through the pandemic years to {peakYear.failRate}% in{" "}
            {peakYear.year}, its highest since 2010, and has declined to {latestYear.failRate}% in{" "}
            {latestYear.year}. The 2010&ndash;2011 rates were higher still, at over 23%, so the long arc
            is downward with a pandemic-era interruption.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <caption>Failure rate by year</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col">Inspections</th>
                  <th scope="col">Fail rate</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{y.n.toLocaleString()}</td>
                    <td>{y.failRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Method ---- */}
        <section className="finding">
          <h2>How this was calculated</h2>
          <p>
            Every figure comes from the City of Chicago&rsquo;s public Food Inspections dataset
            (4ijn-s7e5), the same feed that powers the rest of this site. Four choices shape the numbers,
            and different choices would produce different results:
          </p>
          <ul className="method-list">
            <li>
              <strong>Restaurants and bars only.</strong> The city&rsquo;s feed also covers schools,
              daycares, hospitals, and grocers. Including them changes every rate on this page, because
              those categories are inspected under different expectations.
            </li>
            <li>
              <strong>Only graded inspections count.</strong> Results of &ldquo;Out of Business&rdquo;,
              &ldquo;No Entry&rdquo;, and &ldquo;Not Ready&rdquo; are excluded &mdash; they aren&rsquo;t
              judgments about food safety. That removes {(meta.restaurantBarInspections - meta.gradedInspections).toLocaleString()}{" "}
              records.
            </li>
            <li>
              <strong>Violation analysis starts {meta.violationWindowStart.slice(0, 4)}.</strong> Chicago
              renumbered its violation codes in mid-2018 to align with the FDA Food Code. Comparing
              citations across that boundary would compare codes that mean different things.
            </li>
            <li>
              <strong>One citation per inspection.</strong> A violation cited twice in one report counts
              once, so percentages describe how many inspections mention an item, not raw citation volume.
            </li>
          </ul>
          <p className="hint">
            Analysis last regenerated {meta.generated}. GutCheck is an independent service and is not
            affiliated with the City of Chicago. The underlying data is published by the Chicago
            Department of Public Health; the city notes it may contain duplicate records and should be
            verified against official sources for any consequential use.
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
