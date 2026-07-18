import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../../components/Layout";
import RestaurantCard from "../../components/RestaurantCard";
import AdSlot from "../../components/AdSlot";
import { loadRestaurants, loadNeighborhoods, loadNeighborhoodStats } from "../../lib/data";
import { buildNeighborhoodIntro, buildNeighborhoodFaqCopy } from "../../lib/neighborhoodCopy";

export async function getStaticPaths() {
  const neighborhoods = loadNeighborhoods();
  return {
    paths: neighborhoods.map((n) => ({ params: { neighborhood: n.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const all = loadRestaurants();
  const matches = all.filter((r) => r.nbSlug === params.neighborhood);
  if (matches.length === 0) return { notFound: true };
  const name = matches[0].nb;
  const passCount = matches.filter((r) => r.g === "PASS").length;
  const allStats = loadNeighborhoodStats();
  const stats = allStats.byNeighborhood[params.neighborhood];
  // Only pass the fields RestaurantCard actually renders — the full
  // violation/history payload isn't needed here and bloats the page.
  const restaurants = matches.map((r) => ({ id: r.id, slug: r.slug, n: r.n, nb: r.nb, g: r.g, d: r.d }));
  return { props: { restaurants, name, slug: params.neighborhood, total: all.length, passCount, stats } };
}

export default function NeighborhoodPage({ restaurants, name, slug, total, passCount, stats }) {
  const title = `${name} Restaurant Health Inspections — Chicago | GutCheck`;
  const description = `Official Chicago health inspection records for ${restaurants.length} restaurants in ${name}, Chicago. ${passCount} currently passing, updated from the city's live data feed.`;
  const url = `https://gutcheckchicago.com/n/${slug}`;
  const intro = buildNeighborhoodIntro({ name, stats });
  const faqItems = buildNeighborhoodFaqCopy({ name, stats });

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Restaurants in ${name}, Chicago`,
    itemListElement: restaurants.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://gutcheckchicago.com/r/${r.slug}`,
      name: r.n,
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "GutCheck Chicago", item: "https://gutcheckchicago.com/" },
      { "@type": "ListItem", position: 2, name, item: url },
    ],
  };

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
        <meta property="og:image" content="https://gutcheckchicago.com/og/default.webp" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://gutcheckchicago.com/og/default.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> All neighborhoods
        </Link>
        <div className="eyebrow">Chicago neighborhood · health inspection records</div>
        <h1>{name.toUpperCase()}</h1>
        <p>{intro}</p>
      </div>

      <div className="wrap section">
        <AdSlot variant="banner" />
        <h2 className="eyebrow" style={{ marginTop: 22 }}>All {name} restaurant health inspections</h2>
        <div className="grid">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </div>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">{name} health inspection FAQ</h2>
        <div>
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
