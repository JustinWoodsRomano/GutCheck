import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import Stamp from "../components/Stamp";
import AdSlot from "../components/AdSlot";
import { loadRestaurants, loadCounts } from "../lib/data";

const SITE = "https://www.gutcheckchicago.com";

export async function getStaticProps() {
  return { props: { total: loadCounts().active } };
}

// Straight from the city map's own legend. Worth spelling out because
// "Canvass" is opaque unless you already know the jargon, and the reason an
// inspector showed up changes how you should read the result.
const INSPECTION_TYPES = [
  { name: "Canvass", meaning: "A routine, unannounced visit on the city's own schedule. The most common kind by far." },
  { name: "Complaint", meaning: "Someone reported the place. These fail noticeably more often than routine visits." },
  { name: "Suspected food poisoning", meaning: "Someone reported getting sick after eating there." },
  { name: "License", meaning: "A check tied to a new or renewed food licence, often before opening." },
  { name: "Re-inspection", meaning: "A follow-up after a failure, to see whether the problems were fixed." },
  { name: "Short form complaint", meaning: "A narrower complaint visit covering only the reported issue." },
];

const FAQS = [
  {
    q: "Where can I find restaurant health inspection reports in Chicago?",
    a: "Chicago publishes every food inspection as open data, going back to January 2010. You can browse it three ways: the city's official map below, the raw dataset on the city portal, or this site, which filters the same feed down to restaurants and bars and adds the violation history for each one.",
  },
  {
    q: "Does Chicago give restaurants a letter grade or a score?",
    a: "No. Unlike New York or Los Angeles, Chicago does not issue letter grades or numeric scores. Every inspection ends in one of three outcomes: Pass, Pass with Conditions, or Fail. Anyone quoting a Chicago restaurant's \"score\" is using a number the city never published.",
  },
  {
    q: "What does Pass with Conditions mean?",
    a: "Violations were found, but the inspector judged them correctable and the restaurant stayed open. It sits between a clean pass and a failure. Roughly one in five Chicago inspections ends this way, so it is common rather than alarming on its own.",
  },
  {
    q: "How often are Chicago restaurants inspected?",
    a: "It depends on risk category. High-risk establishments, which is most restaurants serving cooked food, are scheduled more frequently than low-risk ones like coffee shops selling only pre-packaged items. Complaints and follow-up visits happen outside that schedule, which is why some places appear far more often than others.",
  },
  {
    q: "Does a failed inspection mean a restaurant is closed?",
    a: "Not always. A failure can trigger a closure, but many are resolved at a re-inspection within days. Across the city's full record, about 80% of re-inspections pass. A single old failure says much less than a repeated pattern of them.",
  },
];

export default function FoodInspectionMap({ total }) {
  // The city's embed takes roughly 20 seconds to draw its tiles and pulls in
  // a large third-party bundle. Loading it on click keeps that entirely off
  // the critical path for the people who never scroll this far.
  const [mapLoaded, setMapLoaded] = useState(false);

  const title = "Chicago Food Inspection Map & Health Inspection Records | GUTCHECK";
  const description =
    "See Chicago restaurant health inspections on a map, and look up any restaurant's full inspection record. Official city data covering every food inspection since 2010, explained.";
  const url = `${SITE}/food-inspection-map`;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GUTCHECK Chicago", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Food inspection map", item: url },
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
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">GUTCHECK Chicago</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">Food inspection map</span>
      </nav>

      <div className="wrap hero">
        <div className="eyebrow">Official public data · updated daily</div>
        <h1>CHICAGO FOOD INSPECTION MAP</h1>
        <p>
          Chicago inspects roughly 15,000 food establishments and publishes every result. Below is the
          city&rsquo;s own inspection map, plus what the results actually mean &mdash; because
          &ldquo;Pass w/ Conditions&rdquo; and &ldquo;Canvass&rdquo; don&rsquo;t explain themselves.
        </p>
        <p>
          To look up one specific place rather than browse geographically,{" "}
          <Link href="/">search {total.toLocaleString()} Chicago restaurants and bars</Link> for the full
          violation history on each.
        </p>
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />

        <section className="finding">
          <h2>The city&rsquo;s official inspection map</h2>
          <p>
            Published by the Chicago Department of Public Health. It shows the most recent 30 days by
            default and colour-codes each point by why the inspection happened. It covers every food
            establishment &mdash; including schools, daycares and grocers &mdash; not just restaurants.
          </p>
          {/* Loads on its own rather than behind a click. The spinner covers
              the frame until the city's embed fires onLoad, so the wait reads
              as loading rather than as an empty box.

              The embed's width/height query params set the map's INTERNAL
              canvas size; at the old 800x600 it drew letterboxed inside a
              full-width iframe. Asking for a larger canvas lets it fill. */}
          <div className="map-embed-wrap">
            {!mapLoaded && (
              <div className="map-spinner-wrap" role="status" aria-live="polite">
                <svg className="map-spinner" viewBox="0 0 48 48" aria-hidden="true">
                  {/* Plate rim, spinning */}
                  <circle className="map-spinner-plate" cx="24" cy="24" r="20" />
                  {/* Fork and knife, still */}
                  <g className="map-spinner-cutlery">
                    <path d="M19 14v8a2 2 0 0 0 2 2 2 2 0 0 0 2-2v-8" />
                    <path d="M21 24v10" />
                    <path d="M29 14c-1.6 0-2.5 2-2.5 5s.9 5 2.5 5" />
                    <path d="M29 24v10" />
                  </g>
                </svg>
                <span className="map-spinner-label">Map loading</span>
              </div>
            )}
            <iframe
              allow="geolocation"
              src="https://data.cityofchicago.org/dataset/Food-Inspections-Map/cnfp-tsxc/embed?width=1600&height=800"
              title="City of Chicago Food Inspections Map"
              loading="lazy"
              onLoad={() => setMapLoaded(true)}
            />
          </div>
          <p className="hint">
            Source:{" "}
            <a
              href="https://data.cityofchicago.org/dataset/Food-Inspections-Map/cnfp-tsxc"
              rel="nofollow noopener"
              target="_blank"
            >
              City of Chicago Food Inspections &mdash; Map (dataset cnfp-tsxc)
            </a>
            . GUTCHECK is independent and not affiliated with the City of Chicago.
          </p>
        </section>

        <section className="finding">
          <h2>What the inspection types on the map mean</h2>
          <p>
            The map&rsquo;s legend colours points by inspection type. That label matters: an inspection
            triggered by a complaint fails 34% of the time, against 22% for a routine visit, so knowing
            why an inspector showed up changes how you read the outcome.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <caption>Inspection types, in plain language</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">What it means</th>
                </tr>
              </thead>
              <tbody>
                {INSPECTION_TYPES.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{t.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            GUTCHECK labels every inspection with this reason, so you can see at a glance whether a
            result came from a routine visit or a complaint.
          </p>
        </section>

        <section className="finding">
          <h2>The three possible results</h2>
          <p>
            Chicago does not use letter grades or numeric scores. Every inspection ends one of three
            ways, and the middle one causes most of the confusion:
          </p>
          {/* The stamps carry the label, so the bullet is redundant -- and
              showing the real badge here is what makes the rest of the site
              legible at a glance afterwards. */}
          <ul className="result-list">
            <li>
              <Stamp grade="PASS" size="sm" />
              <span>No violations serious enough to require correction.</span>
            </li>
            <li>
              <Stamp grade="CONDITIONAL" size="sm" />
              <span>
                Violations were found but judged correctable, and the place stayed open. About one
                inspection in five.
              </span>
            </li>
            <li>
              <Stamp grade="FAIL" size="sm" />
              <span>
                Serious enough to warrant a failure, sometimes a closure. Roughly 80% of
                re-inspections afterwards pass.
              </span>
            </li>
          </ul>
        </section>

        <section className="finding">
          <h2>City map or GUTCHECK?</h2>
          <p>
            They answer different questions, and the city&rsquo;s map is the better tool for some of
            them:
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">If you want to&hellip;</th>
                  <th scope="col">Use</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Browse recent inspections geographically</td>
                  <td>The city map above</td>
                </tr>
                <tr>
                  <td>See every food establishment, including schools and daycares</td>
                  <td>The city map above</td>
                </tr>
                <tr>
                  <td>Look up one restaurant&rsquo;s full history</td>
                  <td><Link href="/">GUTCHECK</Link></td>
                </tr>
                <tr>
                  <td>Read violations in plain language, with pests flagged</td>
                  <td><Link href="/">GUTCHECK</Link></td>
                </tr>
                <tr>
                  <td>Compare a neighbourhood&rsquo;s restaurants</td>
                  <td><Link href="/">GUTCHECK</Link></td>
                </tr>
                <tr>
                  <td>Analyse citywide patterns across 16 years</td>
                  <td><Link href="/data">Our data analysis</Link></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="finding">
          <h2>Common questions</h2>
          {FAQS.map((f) => (
            <div key={f.q} className="faq-item">
              <div className="faq-q">{f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </section>
      </div>

      <Footer />
    </div>
  );
}
