import Head from "next/head";
import Link from "next/link";
import { Nav, Footer } from "../../components/Layout";
import { loadSlugIndex } from "../../lib/data";

const SITE = "https://www.gutcheckchicago.com";

/**
 * Resource page for violation #55, Physical Facilities.
 *
 * The point of difference: the City of Chicago publishes what the rule says.
 * Nobody publishes whether it matters. These figures come from GUTCHECK's own
 * analysis of 50,000 graded inspections since 2022 and are the reason this
 * page can rank against chicago.gov rather than duplicating it.
 *
 * Every number below was measured, not estimated:
 *   baseline failure rate across the sample .... 27.7%
 *   inspections citing #55 ..................... 28,189 (56.4%)
 *   failure rate when #55 is cited ............. 29.7%  (1.07x baseline)
 *   failure rate when #38 (pests) is cited ..... 62.4%  (2.25x baseline)
 * Regenerate with scripts/build-analysis.mjs if the sample is refreshed.
 */
const STATS = {
  sample: 50000,
  since: "2022",
  baselineFail: 27.7,
  cited: 28189,
  citedShare: 56.4,
  failWhenCited: 29.7,
  lift: 1.07,
  pestFail: 62.4,
  pestLift: 2.25,
};

const COMPARISON = [
  { code: 55, name: "Physical Facilities Installed, Maintained & Clean", cited: 28189, fail: 29.7, lift: 1.07 },
  { code: 47, name: "Food & Non-food Contact Surfaces Cleanable, Properly Designed", cited: 15229, fail: 30.1, lift: 1.09 },
  { code: 51, name: "Plumbing Installed; Proper Backflow Devices", cited: 12162, fail: 31.9, lift: 1.15 },
  { code: 38, name: "Insects, Rodents & Animals Not Present", cited: 10672, fail: 62.4, lift: 2.25 },
  { code: 60, name: "Previous Core Violation Corrected", cited: 3323, fail: 81.2, lift: 2.93 },
  { code: 59, name: "Previous Priority Foundation Violation Corrected", cited: 961, fail: 93.4, lift: 3.37 },
];

export async function getStaticProps() {
  const total = Object.keys(loadSlugIndex()).length;
  return { props: { total }, revalidate: 86400 };
}

export default function PhysicalFacilities({ total }) {
  const title = "Violation 55: Physical Facilities — Chicago Health Code";
  const description = `Chicago health inspection violation #55, Physical Facilities Installed, Maintained & Clean, is the city's most-cited violation — appearing in ${STATS.citedShare}% of graded inspections — yet raises failure risk barely at all. What it covers and what it actually means.`;
  const url = `${SITE}/violations/physical-facilities`;

  const faqs = [
    {
      q: "What is violation 55 in a Chicago health inspection?",
      a: "Violation 55, \"Physical Facilities Installed, Maintained & Clean,\" covers the condition of the building itself rather than the food: floors, walls, ceilings, light shields, vents, storage areas, and general cleanliness of non-food surfaces. It is classified as a core violation, the lowest of Chicago's three severity tiers.",
    },
    {
      q: "Is violation 55 serious?",
      a: `It is the least severe tier and, statistically, the least alarming common violation. Across ${STATS.sample.toLocaleString()} graded Chicago inspections since ${STATS.since}, inspections citing violation 55 failed ${STATS.failWhenCited}% of the time against a ${STATS.baselineFail}% baseline — only ${STATS.lift}× the ordinary risk. By comparison, an inspection citing violation 38 (insects and rodents) failed ${STATS.pestFail}% of the time, ${STATS.pestLift}× baseline. Seeing #55 on a report is close to seeing nothing at all.`,
    },
    {
      q: "Why is violation 55 cited so often?",
      a: `It appears in ${STATS.citedShare}% of graded inspections — more than any other violation — because it is broad. A cracked floor tile, a dusty vent cover, a missing light shield and a cluttered storeroom all land under the same code. Breadth, not severity, is what makes it the most-written-up item in Chicago.`,
    },
    {
      q: "Can a restaurant fail an inspection for violation 55 alone?",
      a: "Rarely. A core violation on its own does not normally cause a failure; failures are usually driven by priority violations, or by a large number of unresolved items. When an inspection citing #55 fails, it is typically because something more serious was cited in the same visit.",
    },
    {
      q: "What is the difference between a core, priority foundation, and priority violation?",
      a: "Chicago classifies violations into three tiers. Priority violations pose the most direct risk of foodborne illness — improper temperatures, contamination, pest activity. Priority foundation violations support those controls, such as missing procedures or equipment. Core violations, including #55, relate to general maintenance, sanitation and facility condition. GUTCHECK lists priority violations before core ones on every restaurant page for this reason.",
    },
    {
      q: "Where does this data come from?",
      a: `The violation records come from the City of Chicago's Food Inspections dataset, published as open data (4ijn-s7e5). The failure-rate figures are GUTCHECK's own analysis of ${STATS.sample.toLocaleString()} graded inspections since ${STATS.since}; the city does not publish them.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: "Violation 55: Physical Facilities Installed, Maintained & Clean",
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
        about: {
          "@type": "Thing",
          name: "Chicago health inspection violation 55, Physical Facilities Installed, Maintained & Clean",
        },
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
          { "@type": "ListItem", position: 2, name: "Inspection data analysis", item: `${SITE}/data` },
          { "@type": "ListItem", position: 3, name: "Violation 55: Physical Facilities", item: url },
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
        <Link href="/data" className="back-link">&larr; Inspection data analysis</Link>
        <div className="eyebrow">Violation 55 &middot; core violation</div>
        <h1>PHYSICAL FACILITIES.</h1>

        {/* Answer-first, with the counter-intuitive finding in the opening
            sentence — this is the claim the page exists to make. */}
        <p className="lede">
          Violation 55 is the most-cited item in Chicago health inspections, appearing in{" "}
          {STATS.citedShare}% of them — and it is one of the least predictive of an actual
          failure. Inspections citing it fail {STATS.failWhenCited}% of the time against a{" "}
          {STATS.baselineFail}% baseline, barely above ordinary risk.
        </p>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">What violation 55 covers</h2>
        <div className="prose">
          <p>
            The full name in the city&rsquo;s records is{" "}
            <strong>&ldquo;Physical Facilities Installed, Maintained &amp; Clean.&rdquo;</strong>{" "}
            It applies to the building rather than the food — floors, walls and ceilings,
            light shields, ventilation covers, storage areas, and the general cleanliness of
            surfaces that food never touches.
          </p>
          <p>
            It is a <strong>core violation</strong>, the lowest of the three tiers the
            Chicago Department of Public Health uses. Core violations relate to general
            maintenance and sanitation. Above them sit priority foundation violations, which
            cover the procedures and equipment that make food safety controls possible, and{" "}
            priority violations, which address the most direct routes to foodborne illness —
            temperature abuse, contamination, pest activity.
          </p>
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Why it appears on so many reports</h2>
        <div className="prose">
          <p>
            Because it is broad. A cracked floor tile, a dusty vent cover, a missing light
            shield and a cluttered stockroom are all violation 55. Almost every commercial
            kitchen in continuous use has something that qualifies on any given day, which
            is why it heads the list — {STATS.cited.toLocaleString()} of the{" "}
            {STATS.sample.toLocaleString()} graded inspections analysed.
          </p>
          <p>
            Breadth is not severity, and the two are easy to confuse when you are reading a
            report. A restaurant with three violation-55 citations and nothing else is in
            markedly better shape than one with a single pest citation.
          </p>
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">How it compares to other violations</h2>
        <p className="section-note section-note-left">
          Failure rate of inspections citing each violation, against a{" "}
          {STATS.baselineFail}% baseline across {STATS.sample.toLocaleString()} graded Chicago
          inspections since {STATS.since}. This analysis is GUTCHECK&rsquo;s own; the city
          publishes the records but not these rates.
        </p>
        <div className="viol-compare">
          {COMPARISON.map((v) => (
            <div key={v.code} className={`viol-compare-row${v.code === 55 ? " viol-compare-focus" : ""}`}>
              <div className="viol-compare-head">
                <span className="viol-compare-code">#{v.code}</span>
                <span className="viol-compare-name">{v.name}</span>
              </div>
              <div className="viol-compare-bar-wrap">
                <div
                  className="viol-compare-bar"
                  style={{ width: `${Math.min(100, (v.fail / 100) * 100)}%` }}
                />
              </div>
              <div className="viol-compare-meta">
                {v.fail}% fail rate &middot; {v.lift}&times; baseline &middot; cited{" "}
                {v.cited.toLocaleString()} times
              </div>
            </div>
          ))}
        </div>
        <p className="section-note section-note-left">
          The two most predictive items are not conditions at all — they are{" "}
          <strong>previous violations not corrected</strong>. An inspection citing an
          uncorrected priority foundation violation failed 93.4% of the time. What a
          restaurant does after being told is a far stronger signal than any single finding.
        </p>
        <Link href="/data" className="cta-btn">
          See the full inspection data analysis
        </Link>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Violation 55 FAQ</h2>
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
            <a href="https://www.chicago.gov/city/en/depts/cdph/provdrs/food_safety/svcs/restaurant-inspection.html" rel="nofollow noopener" target="_blank">
              Chicago Department of Public Health — Restaurant Inspection
            </a>
            <span className="source-note">
              The city&rsquo;s own description of how inspections are conducted and how
              violations are classified.
            </span>
          </li>
          <li>
            <a href="https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5" rel="nofollow noopener" target="_blank">
              City of Chicago — Food Inspections dataset (4ijn-s7e5)
            </a>
            <span className="source-note">
              Every inspection record referenced on this page, published as open data.
            </span>
          </li>
          <li>
            <Link href="/data">GUTCHECK — analysis of 184,618 Chicago inspections</Link>
            <span className="source-note">
              Where the failure-rate and severity figures come from.
            </span>
          </li>
        </ul>
      </div>

      <Footer />
    </div>
  );
}
