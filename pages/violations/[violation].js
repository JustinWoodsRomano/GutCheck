import Head from "next/head";
import Link from "next/link";
import { Nav, Footer } from "../../components/Layout";
import { loadSlugIndex, loadCounts } from "../lib/data";
import VIOLATION_DATA from "../../data/violations.json";
import { violationSlug, severityOf, severityBlurb } from "../../lib/violations.mjs";

const SITE = "https://www.gutcheckchicago.com";

/**
 * One page per violation code.
 *
 * What makes each of these worth existing rather than duplicating chicago.gov:
 * the two measured figures. The city says what the rule is; only this dataset
 * says how often it is cited and whether it predicts a failure. Everything
 * narrative on the page is generated from those numbers and the code's tier,
 * so no page asserts anything the data does not carry.
 */
export async function getStaticPaths() {
  return {
    paths: VIOLATION_DATA.violations.map((v) => ({ params: { violation: violationSlug(v) } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const v = VIOLATION_DATA.violations.find((x) => violationSlug(x) === params.violation);
  if (!v) return { notFound: true };
  const total = loadCounts().active;

  const sorted = [...VIOLATION_DATA.violations].sort((a, b) => b.cited - a.cited);
  const rankByCitation = sorted.findIndex((x) => x.code === v.code) + 1;
  const byRisk = [...VIOLATION_DATA.violations].sort((a, b) => b.lift - a.lift);
  const rankByRisk = byRisk.findIndex((x) => x.code === v.code) + 1;

  // Neighbours in the same tier, for internal linking.
  const tier = severityOf(v.code).key;
  const related = sorted
    .filter((x) => x.code !== v.code && severityOf(x.code).key === tier)
    .slice(0, 6);

  return {
    props: { v, total, meta: VIOLATION_DATA, rankByCitation, rankByRisk, related },
    revalidate: 86400,
  };
}

export default function ViolationPage({ v, total, meta, rankByCitation, rankByRisk, related }) {
  const sev = severityOf(v.code);
  const url = `${SITE}/violations/${violationSlug(v)}`;
  const share = ((v.cited / meta.sample) * 100).toFixed(1);

  // Plain-language read of the risk number, derived rather than asserted.
  const verdict =
    v.lift >= 2
      ? "a strong signal"
      : v.lift >= 1.4
      ? "a meaningful signal"
      : v.lift >= 1.15
      ? "a mild signal"
      : "close to no signal at all";

  const title = `Violation ${v.code}: ${v.title} — Chicago`;
  const description = `Chicago health inspection violation ${v.code}, ${v.title}. Cited at ${v.cited.toLocaleString()} inspections (${share}%), with a ${v.failRate}% failure rate against a ${meta.baselineFail}% baseline — ${v.lift}× ordinary risk.`;

  const faqs = [
    {
      q: `What is violation ${v.code} in a Chicago health inspection?`,
      a: `Violation ${v.code}, "${v.title}", is one of the numbered items on the Chicago Department of Public Health's inspection checklist. By its position on that form it falls in the ${sev.label.toLowerCase()} band. ${severityBlurb(sev.key)}`,
    },
    {
      q: `Is violation ${v.code} serious?`,
      a: `Measured against outcomes, it is ${verdict}. Inspections citing violation ${v.code} ended in a failure ${v.failRate}% of the time, against a ${meta.baselineFail}% baseline across ${meta.sample.toLocaleString()} graded Chicago inspections — ${v.lift}× ordinary risk. ${v.lift >= 2 ? "That places it among the strongest predictors of a failed inspection in the whole dataset." : v.lift < 1.15 ? "In practice, seeing it on a report tells you very little about whether the inspection went badly." : "It is worth noting, but it is not on its own a reason to avoid a restaurant."}`,
    },
    {
      q: `How common is violation ${v.code}?`,
      a: `It is the ${ordinal(rankByCitation)} most-cited violation in Chicago, appearing at ${v.cited.toLocaleString()} of ${meta.sample.toLocaleString()} graded inspections since ${meta.since} — ${share}% of them.`,
    },
    {
      q: `Can a restaurant fail an inspection for violation ${v.code} alone?`,
      a:
        sev.key === "priority"
          ? `Yes. Priority violations address the most direct routes to foodborne illness, and a single one can fail an inspection on its own.`
          : sev.key === "foundation"
          ? `Sometimes. Priority foundation violations can fail an inspection, particularly when several appear together or when a previous one was left uncorrected.`
          : `Rarely. Core violations do not normally cause a failure by themselves. When an inspection citing this item fails, something more serious was usually cited at the same visit.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: `Violation ${v.code}: ${v.title}`,
        description,
        mainEntityOfPage: url,
        isBasedOn: "https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5",
        publisher: { "@id": `${SITE}/#org` },
        author: {
          "@type": "Person",
          name: "Justin Woods-Romano",
          url: `${SITE}/about`,
          affiliation: { "@type": "Organization", name: "Built by Backspace" },
        },
        about: { "@type": "Thing", name: `Chicago health inspection violation ${v.code}` },
        citation: [
          "https://www.chicago.gov/city/en/depts/cdph/provdrs/food_safety/svcs/restaurant-inspection.html",
          "https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5",
        ],
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
          { "@type": "ListItem", position: 2, name: "Violation codes", item: `${SITE}/violations` },
          { "@type": "ListItem", position: 3, name: `Violation ${v.code}`, item: url },
        ],
      },
    ],
  };

  return (
    <div>
      <Head>
        <title>{title.length > 60 ? `Violation ${v.code}: ${v.title}`.slice(0, 60) : title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og/default.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/violations" className="back-link">&larr; All violation codes</Link>
        <div className="eyebrow">
          Violation {v.code} &middot; <span className={`sev-tag sev-${sev.key}`}>{sev.label}</span>
        </div>
        <h1>{v.title.toUpperCase()}.</h1>
        <p className="lede">
          Cited at {v.cited.toLocaleString()} of {meta.sample.toLocaleString()} graded Chicago
          inspections &mdash; {share}% of them, the {ordinal(rankByCitation)} most common violation
          in the city. Inspections citing it fail {v.failRate}% of the time against a{" "}
          {meta.baselineFail}% baseline, making it {verdict}.
        </p>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">What it means</h2>
        <div className="prose">
          <p>
            Violation {v.code} appears on the Chicago Department of Public Health&rsquo;s inspection
            checklist as <strong>&ldquo;{v.title}.&rdquo;</strong> Its position on that form places
            it in the <strong>{sev.label.toLowerCase()}</strong> band &mdash; the city does not
            publish a severity field, so this is inferred from the code number, which is how the
            form itself is ordered.
          </p>
          <p>{severityBlurb(sev.key)}</p>
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">How much it actually matters</h2>
        <div className="viol-stat-grid">
          <div className="viol-stat">
            <span className="viol-stat-num">{share}%</span>
            <span className="viol-stat-label">of graded inspections cite it</span>
          </div>
          <div className="viol-stat">
            <span className="viol-stat-num">{v.failRate}%</span>
            <span className="viol-stat-label">of those inspections failed</span>
          </div>
          <div className="viol-stat viol-stat-accent">
            <span className="viol-stat-num">{v.lift}&times;</span>
            <span className="viol-stat-label">
              ordinary risk ({meta.baselineFail}% baseline)
            </span>
          </div>
        </div>
        <div className="prose">
          <p>
            Ranked by how often it is written up, violation {v.code} is{" "}
            {ordinal(rankByCitation)} of {meta.violations.length}. Ranked by how strongly it predicts
            a failure, it is {ordinal(rankByRisk)}.{" "}
            {rankByCitation < rankByRisk - 8
              ? "It is written up far more than its risk warrants — a common finding, and the reason a long violation list is not by itself alarming."
              : rankByRisk < rankByCitation - 8
              ? "It matters considerably more than its frequency suggests, which makes it easy to overlook on a busy report."
              : "Its frequency and its risk sit at roughly the same place in the ranking."}
          </p>
        </div>
        <Link href="/violations" className="cta-btn">
          Compare every violation code
        </Link>
      </div>

      {related.length > 0 && (
        <div className="wrap section">
          <h2 className="eyebrow">Other {sev.label.toLowerCase()} violations</h2>
          <ol className="viol-list">
            {related.map((x) => (
              <li key={x.code} className="viol-li-linked">
                <Link href={`/violations/${violationSlug(x)}`} className="viol-cell-link">
                  <span className="viol-cell-body">
                    <span className="viol-title">{x.title}</span>
                    <span className="viol-meta">
                      cited {x.cited.toLocaleString()} times &middot; {x.failRate}% fail rate &middot;{" "}
                      {x.lift}&times; baseline
                    </span>
                  </span>
                  <span className="viol-cta" aria-hidden="true">Learn more</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="wrap section">
        <h2 className="eyebrow">Violation {v.code} FAQ</h2>
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
            {meta.sample.toLocaleString()} inspections since {meta.since} with a graded result of
            Pass, Pass w/ Conditions or Fail, with each violation string parsed for its leading code
            number. The rate above is the share of inspections citing violation {v.code} that ended
            in a failure. A single inspection commonly cites several violations, so codes are not
            mutually exclusive. Anyone can reproduce this from the dataset linked above.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
