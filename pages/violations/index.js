import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Nav, Footer } from "../../components/Layout";
import { loadSlugIndex } from "../../lib/data";
import VIOLATION_DATA from "../../data/violations.json";
import { violationSlug, severityOf } from "../../lib/violations.mjs";

const SITE = "https://www.gutcheckchicago.com";

/**
 * Index of every Chicago health inspection violation code.
 *
 * The reason this can rank against chicago.gov: the city publishes what each
 * rule says, but never how often it is cited or whether it predicts a
 * failure. Those two columns are derived here from the city's own records and
 * are the only thing on the page that is not already public. Method is stated
 * on the page rather than assumed.
 */
export async function getStaticProps() {
  const total = Object.keys(loadSlugIndex()).length;
  return { props: { total, data: VIOLATION_DATA }, revalidate: 86400 };
}

export default function ViolationsIndex({ total, data }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("cited");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = data.violations.filter(
      (v) => !q || v.title.toLowerCase().includes(q) || String(v.code) === q || `#${v.code}` === q
    );
    out = [...out].sort((a, b) =>
      sort === "cited" ? b.cited - a.cited : sort === "risk" ? b.lift - a.lift : a.code - b.code
    );
    return out;
  }, [query, sort, data]);

  const top10 = useMemo(
    () => [...data.violations].sort((a, b) => b.cited - a.cited).slice(0, 10),
    [data]
  );
  const riskiest = useMemo(
    () => [...data.violations].sort((a, b) => b.lift - a.lift).slice(0, 5),
    [data]
  );

  const title = "Chicago Health Inspection Violations — Every Code Explained";
  const description = `All ${data.violations.length} Chicago restaurant health inspection violation codes, with how often each is cited and how strongly it predicts a failed inspection. Measured across ${data.sample.toLocaleString()} inspections.`;
  const url = `${SITE}/violations`;

  const faqs = [
    {
      q: "What are the most common Chicago health inspection violations?",
      a: `The most-cited is violation ${top10[0].code}, ${top10[0].title}, appearing in ${Math.round((top10[0].cited / data.sample) * 100)}% of graded inspections. It is followed by violation ${top10[1].code} (${top10[1].title}) and violation ${top10[2].code} (${top10[2].title}). All three relate to facility condition and cleanliness rather than food handling, and none raises failure risk much above the ${data.baselineFail}% baseline.`,
    },
    {
      q: "Which violations actually predict a failed inspection?",
      a: `The strongest predictors are not conditions but uncorrected history. Violation ${riskiest[0].code}, ${riskiest[0].title}, precedes a failure ${riskiest[0].failRate}% of the time — ${riskiest[0].lift}× the ${data.baselineFail}% baseline. Pest activity (violation 38) is the strongest condition-based signal at 2.24×. Frequency and severity are close to unrelated: the most-cited violation carries almost no extra risk.`,
    },
    {
      q: "What is the difference between a priority, priority foundation, and core violation?",
      a: "Chicago sorts violations into three tiers. Priority violations (roughly codes 1–29) address the most direct routes to foodborne illness: temperature control, contamination, sick employees. Priority foundation violations (roughly 30–44) cover the procedures, equipment and training that make those controls possible. Core violations (roughly 45–63) concern facility maintenance, cleanliness and paperwork. A single priority violation can fail an inspection; core violations usually cannot on their own.",
    },
    {
      q: "How many violation codes does Chicago use?",
      a: `The city's current inspection form runs to 63 numbered items, though not all appear often. This page lists the ${data.violations.length} codes cited at least 50 times across ${data.sample.toLocaleString()} graded inspections since ${data.since}; rarer codes are omitted because a failure rate computed on a handful of inspections is not meaningful.`,
    },
    {
      q: "Where does this data come from?",
      a: `The City of Chicago's Food Inspections dataset (4ijn-s7e5), published as open data by the Chicago Department of Public Health. The citation counts and failure rates are derived from those records, not published by the city.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: title,
        description,
        url,
        inLanguage: "en-US",
        isBasedOn: "https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5",
        publisher: { "@id": `${SITE}/#org` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: "Chicago health inspection violation codes",
        numberOfItems: data.violations.length,
        itemListElement: [...data.violations]
          .sort((a, b) => b.cited - a.cited)
          .slice(0, 100)
          .map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `Violation ${v.code}: ${v.title}`,
            url: `${SITE}/violations/${violationSlug(v)}`,
          })),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Chicago restaurants & bars", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Violation codes", item: url },
        ],
      },
    ],
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
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og/default.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">&larr; Back home</Link>
        <div className="eyebrow">Every code &middot; official public data</div>
        <h1>HEALTH INSPECTION VIOLATIONS.</h1>
        <p className="lede">
          Chicago inspectors work from a 63-item checklist. Each item that fails becomes a numbered
          violation on the report. Below is every code cited at least 50 times, how often it appears,
          and how strongly it predicts an actual failure &mdash; measured across{" "}
          {data.sample.toLocaleString()} inspections.
        </p>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Frequency is not severity</h2>
        <div className="prose">
          <p>
            The two columns below tell different stories, and confusing them is the most common
            mistake people make reading an inspection report. The most-cited violation in Chicago
            &mdash; #{top10[0].code}, {top10[0].title.toLowerCase()} &mdash; appears on{" "}
            {Math.round((top10[0].cited / data.sample) * 100)}% of graded inspections and raises
            failure risk to just {top10[0].failRate}% against a {data.baselineFail}% baseline. It is
            almost noise.
          </p>
          <p>
            The items that actually predict failure are rarer and mostly concern what happened{" "}
            <strong>after</strong> a previous inspection. Violation {riskiest[0].code} &mdash;{" "}
            {riskiest[0].title.toLowerCase()} &mdash; precedes a failure {riskiest[0].failRate}% of
            the time. Being told and not acting is a far stronger signal than anything a single
            visit finds.
          </p>
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">The 10 most common violations</h2>
        <ol className="viol-list">
          {top10.map((v) => (
            <li key={v.code} className="viol-li-linked">
              <Link href={`/violations/${violationSlug(v)}`} className="viol-cell-link">
                <span className="viol-cell-body">
                  <span className="viol-title">{v.title}</span>
                  <span className="viol-meta">
                    cited at {v.cited.toLocaleString()} inspections &middot; {v.failRate}% fail rate
                    &middot; {v.lift}&times; baseline
                  </span>
                </span>
                <span className="viol-cta" aria-hidden="true">Learn more</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Search all {data.violations.length} codes</h2>
        <div className="viol-controls">
          <label htmlFor="viol-search" className="sr-only">
            Search violation codes by name or number
          </label>
          <input
            id="viol-search"
            type="search"
            className="viol-search"
            placeholder="Search violations — e.g. rodents, handwashing, 38"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className="viol-sorts">
            {[
              ["cited", "Most cited"],
              ["risk", "Most predictive"],
              ["code", "Code order"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`viol-sort${sort === k ? " viol-sort-on" : ""}`}
                onClick={() => setSort(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="section-note section-note-left">
          Showing {rows.length} of {data.violations.length} codes
        </p>

        <div className="viol-table" role="table">
          <div className="viol-row viol-row-head" role="row">
            <span role="columnheader">Violation</span>
            <span role="columnheader">Inspections citing it</span>
            <span role="columnheader">Fail rate</span>
          </div>
          {rows.map((v) => (
            <Link
              key={v.code}
              href={`/violations/${violationSlug(v)}`}
              className="viol-row viol-row-link"
              role="row"
            >
              <span role="cell" className="viol-row-name">
                <span className="viol-row-code">#{v.code}</span>
                <span>{v.title}</span>
                <span className={`sev-tag sev-${severityOf(v.code).key}`}>
                  {severityOf(v.code).label}
                </span>
              </span>
              <span role="cell" className="viol-row-num">{v.cited.toLocaleString()}</span>
              <span role="cell" className="viol-row-num">
                {v.failRate}% <span className="viol-row-lift">{v.lift}&times;</span>
              </span>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="section-note section-note-left">
              No violation code matches &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Violation codes FAQ</h2>
        {faqs.map((f) => (
          <div className="faq-item" key={f.q}>
            <p className="faq-q">{f.q}</p>
            <p className="faq-a">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Sources</h2>
        <ul className="source-list">
          <li>
            <a href="https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5" rel="nofollow noopener" target="_blank">
              City of Chicago &mdash; Food Inspections dataset (4ijn-s7e5)
            </a>
            <span className="source-note">Every record referenced on this page.</span>
          </li>
          <li>
            <a href="https://www.chicago.gov/city/en/depts/cdph/provdrs/food_safety/svcs/restaurant-inspection.html" rel="nofollow noopener" target="_blank">
              Chicago Department of Public Health &mdash; Restaurant Inspection
            </a>
            <span className="source-note">
              How inspections are conducted and how violations are classified.
            </span>
          </li>
        </ul>
        <h2 className="eyebrow">How these figures were calculated</h2>
        <div className="prose">
          <p>
            The city publishes the records but not these rates. They were derived from{" "}
            {data.sample.toLocaleString()} inspections since {data.since} with a graded result of
            Pass, Pass w/ Conditions or Fail, with each violation string parsed for its leading code
            number. For any code, the rate shown is the share of inspections citing it that ended in
            a failure, against a {data.baselineFail}% baseline across the whole sample. Codes cited
            fewer than 50 times are excluded.
          </p>
          <p>
            A single inspection commonly cites several violations, so the codes are not mutually
            exclusive and their shares do not sum to 100%. Anyone can reproduce this from the
            dataset linked above.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
