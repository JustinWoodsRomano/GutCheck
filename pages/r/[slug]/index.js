import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
import { Nav, Footer } from "../../../components/Layout";
import Stamp from "../../../components/Stamp";
import HistoryAccordion from "../../../components/HistoryAccordion";
import { MapEmbed, ContactRow, RestaurantLogo } from "../../../components/Contact";
import AdSlot from "../../../components/AdSlot";
import { loadRestaurants } from "../../../lib/data";
import { GRADE_LABEL } from "../../../lib/constants";
import { buildRestaurantFaq } from "../../../lib/restaurantCopy";

export async function getStaticPaths() {
  const restaurants = loadRestaurants();
  return {
    paths: restaurants.map((r) => ({ params: { slug: r.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const restaurants = loadRestaurants();
  const restaurant = restaurants.find((r) => r.slug === params.slug);
  if (!restaurant) return { notFound: true };
  const total = restaurants.length;
  return { props: { restaurant, total } };
}

export default function RestaurantPage({ restaurant: r, total }) {
  const gradeLabel = GRADE_LABEL[r.g];
  const title = `${r.n} Health Inspection — ${r.nb}, Chicago | GutCheck`;
  const description = `${r.n} in ${r.nb}, Chicago most recently ${gradeLabel === "Fail" ? "failed" : gradeLabel === "Pass" ? "passed" : "received a Pass w/ Conditions on"} its Chicago health inspection on ${r.d}. See full violation details and inspection history.`;
  const url = `https://gutcheckchicago.com/r/${r.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: r.n,
    address: {
      "@type": "PostalAddress",
      streetAddress: r.a,
      addressLocality: "Chicago",
      addressRegion: "IL",
      postalCode: r.z,
      addressCountry: "US",
    },
    ...(r.lat && r.lon ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lon } } : {}),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Most Recent Health Inspection Result",
        value: gradeLabel,
      },
      {
        "@type": "PropertyValue",
        name: "Most Recent Inspection Date",
        value: r.d,
      },
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GutCheck Chicago", item: "https://gutcheckchicago.com/" },
      { "@type": "ListItem", position: 2, name: r.nb, item: `https://gutcheckchicago.com/n/${r.nbSlug}` },
      { "@type": "ListItem", position: 3, name: r.n, item: url },
    ],
  };

  const faqItems = buildRestaurantFaq(r);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="restaurant" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`https://gutcheckchicago.com/og/${r.slug}.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="1200" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`https://gutcheckchicago.com/og/${r.slug}.webp`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <div className="detail">
        <Link href="/" className="contact-chip back-btn">
          <ArrowLeft size={13} /> Back to results
        </Link>

        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", color: "var(--ink)", marginBottom: 20 }}>
          As of <strong>{r.d}</strong>, <strong>{r.n}</strong> {gradeLabel === "Fail" ? "failed" : gradeLabel === "Pass" ? "passed" : "received a Pass w/ Conditions on"} its most recent City of Chicago health inspection.
        </p>

        <div className="detail-head">
          <RestaurantLogo logoUrl={r.logoUrl} name={r.n} neighborhood={r.nb} grade={r.g} />
          <div className="detail-titles">
            <h1>{r.n}</h1>
          </div>
          <Stamp grade={r.g} size="lg" />
        </div>

        <div className="detail-sub">
          <MapPin size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
          {r.a}, Chicago, IL {r.z}
        </div>
        <div className="detail-sub2">
          <Link href={`/n/${r.nbSlug}`} style={{ textDecoration: "underline" }}>{r.nb}</Link> · Chicago Dept. of Public Health · Last inspected {r.d}
        </div>

        <ContactRow
          address={`${r.a}, Chicago, IL ${r.z}`}
          phone={r.phone}
          website={r.website}
          restaurant={r}
          shareUrl={url}
        />

        <MapEmbed address={`${r.a}, Chicago, IL ${r.z}`} lat={r.lat} lon={r.lon} />

        <h2 className="eyebrow">Violations at most recent inspection</h2>
        <div style={{ marginBottom: 20 }}>
          {r.v.length === 0 && r.g === "PASS" && (
            <div style={{ fontFamily: "var(--font-serif)", color: "var(--seal-green)", fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} /> No violations recorded at last inspection.
            </div>
          )}
          {r.v.length === 0 && r.g !== "PASS" && (
            <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink-muted)", fontSize: "0.92rem", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                The City of Chicago&rsquo;s public record for this inspection lists a result of{" "}
                <strong>{r.g === "FAIL" ? "Fail" : "Pass w/ Conditions"}</strong> but doesn&rsquo;t include itemized
                violation text. GutCheck displays exactly what the city publishes and doesn&rsquo;t infer or add
                violation details that aren&rsquo;t in the official record.
              </span>
            </div>
          )}
          {r.v.map((v, i) => (
            <div key={i} className={`violation ${v.s === "c" ? "critical" : "noncritical"}`}>
              <AlertTriangle size={16} color={v.s === "c" ? "var(--stamp-red)" : "var(--amber)"} style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="violation-body">
                <div className="violation-text">{v.t}</div>
                <div className="violation-sev">{v.s === "c" ? "priority violation" : "core violation"}</div>
              </div>
            </div>
          ))}
        </div>

        <AdSlot variant="banner" />

        {r.hi?.length > 0 && (
          <div style={{ margin: "26px 0 8px" }}>
            <h2 className="eyebrow">Inspection history — tap to expand</h2>
            <HistoryAccordion history={r.hi} />
          </div>
        )}

        <div style={{ margin: "26px 0 8px" }}>
          <h2 className="eyebrow">{r.n} health inspection FAQ</h2>
          {faqItems.map((f) => (
            <div className="faq-item" key={f.q}>
              <p className="faq-q">{f.q}</p>
              <p className="faq-a">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
