import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

export async function getStaticProps() {
  const restaurants = loadRestaurants();
  return { props: { total: restaurants.length, lastUpdated: restaurants[0]?.d || null } };
}

export default function About({ total, lastUpdated }) {
  const title = "About GutCheck Chicago — Data Source & Methodology";
  const description =
    "How GutCheck sources and updates Chicago restaurant health inspection data, and how grades and violations are determined.";

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "GutCheck Chicago Restaurant Health Inspection Records",
    description:
      "Currently-active Chicago restaurants with their most recent City of Chicago health inspection result, violations, and inspection history, rebuilt from the city's live open-data feed.",
    url: "https://gutcheckchicago.com/about",
    isBasedOn: "https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5",
    creator: { "@type": "Organization", name: "GutCheck Chicago" },
    license: "https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html",
    variableMeasured: ["Inspection result", "Violation severity", "Inspection date"],
    temporalCoverage: "2022-01-01/..",
    spatialCoverage: { "@type": "Place", name: "Chicago, Illinois" },
  };

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://gutcheckchicago.com/og/default.webp" />
        <link rel="canonical" href="https://gutcheckchicago.com/about" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">About the data</div>
        <h1>METHODOLOGY.</h1>
      </div>

      <div className="wrap section prose" style={{ maxWidth: 720 }}>
        <p>
          GutCheck is an independent tool that reorganizes the City of Chicago&rsquo;s own public
          health inspection records into a searchable, readable format. It does not conduct
          inspections, alter results, or represent the City of Chicago in any way.
        </p>

        <h2>Where the data comes from</h2>
        <p>
          Every record on GutCheck comes directly from the City of Chicago&rsquo;s Food Inspections
          open-data feed, published by the Chicago Department of Public Health&rsquo;s Food Protection
          Program (data.cityofchicago.org, dataset ID 4ijn-s7e5). The city has published this dataset
          since January 1, 2010, and updates it daily.
        </p>

        <h2>How grades are determined</h2>
        <p>
          Each restaurant&rsquo;s inspection results in one of three outcomes: Pass, Pass w/ Conditions,
          or Fail. Violations found during an inspection are further classified as Priority, Priority
          Foundation, or Core, based on how directly they relate to foodborne illness risk. GutCheck
          displays a restaurant&rsquo;s most recent graded inspection along with its recent history.
        </p>

        <h2>Update cadence</h2>
        <p>
          GutCheck rebuilds its full dataset from the city&rsquo;s live feed on every deployment,
          currently at least once daily.{lastUpdated ? ` The most recent inspection currently on file is dated ${lastUpdated}.` : ""}
        </p>

        <h2>Coverage</h2>
        <p>
          GutCheck currently covers {total.toLocaleString()} currently-active restaurants within
          Chicago city limits. Some nearby suburbs commonly referred to as "Chicago" — including Oak
          Park, Elmwood Park, and Rosemont — are inspected by separate local or contracted health
          departments rather than the Chicago Department of Public Health, and are not yet included
          because no comparable public open-data feed has been identified for them.
        </p>

        <h2>Disclaimer</h2>
        <p>
          Violations noted during an inspection are allegations at the time of inspection and may be
          disputed or corrected afterward. Inspection results reflect a single point in time and are
          not a guarantee of current or future conditions.
        </p>
      </div>

      <Footer />
    </div>
  );
}
