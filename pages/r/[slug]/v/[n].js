import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Nav, Footer } from "../../../../components/Layout";
import ShareButton from "../../../../components/ShareButton";
import { loadRestaurants } from "../../../../lib/data";

// One page per violation, e.g. /r/some-restaurant-123/v/2. This exists to
// be a highly specific, highly shareable target -- a single flagged
// violation with its own OG card styled to match the on-site violation
// treatment exactly -- not to compete with the main restaurant page for
// search ranking. Canonical points back to the parent page and the page
// is marked noindex for that reason; it's still fully crawlable by social
// link-preview bots (noindex only affects Google's own search index).
export async function getStaticPaths() {
  const restaurants = loadRestaurants();
  const paths = [];
  for (const r of restaurants) {
    (r.v || []).forEach((_, i) => {
      paths.push({ params: { slug: r.slug, n: String(i + 1) } });
    });
  }
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const restaurants = loadRestaurants();
  const restaurant = restaurants.find((r) => r.slug === params.slug);
  if (!restaurant) return { notFound: true };
  const index = parseInt(params.n, 10) - 1;
  const violation = restaurant.v?.[index];
  if (!Number.isInteger(index) || !violation) return { notFound: true };
  const total = restaurants.length;
  return { props: { restaurant, violation, index, total } };
}

export default function ViolationPage({ restaurant: r, violation, index, total }) {
  const isCritical = violation.s === "c";
  const sevLabel = isCritical ? "Priority Violation" : "Core Violation";
  const restaurantUrl = `https://gutcheckchicago.com/r/${r.slug}`;
  const url = `${restaurantUrl}/v/${index + 1}`;
  const title = `${sevLabel} Found at ${r.n} \u2014 ${r.nb}, Chicago | GutCheck`;
  const description = `Chicago health inspectors flagged: "${violation.t}" at ${r.n} in ${r.nb}. See the full inspection report on GutCheck.`;
  const imageUrl = `https://gutcheckchicago.com/og/v/${r.slug}-${index + 1}.webp`;

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={restaurantUrl} />
        <meta name="robots" content="noindex, follow" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="900" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={imageUrl} />
      </Head>

      <Nav total={total} />

      <div className="detail">
        <Link href={`/r/${r.slug}`} className="contact-chip back-btn">
          <ArrowLeft size={13} /> Back to full report
        </Link>

        <div className="eyebrow">{r.nb}, Chicago · Chicago Dept. of Public Health</div>
        <h1 style={{ marginBottom: 20 }}>{r.n}</h1>

        <div className={`violation ${isCritical ? "critical" : "noncritical"}`} style={{ marginBottom: 20 }}>
          <AlertTriangle
            size={18}
            color={isCritical ? "var(--stamp-red)" : "var(--amber)"}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div className="violation-body">
            <div className="violation-text" style={{ fontSize: "1.05rem" }}>{violation.t}</div>
            <div className="violation-sev">{sevLabel.toLowerCase()}</div>
          </div>
        </div>

        <ShareButton restaurant={r} url={url} violation={violation} />

        <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", color: "var(--ink-muted)", marginTop: 24 }}>
          This was one of the violations recorded during {r.n}&rsquo;s most recent City of Chicago health
          inspection on {r.d}.{" "}
          <Link href={`/r/${r.slug}`} style={{ textDecoration: "underline" }}>
            View the full inspection report
          </Link>{" "}
          for all violations and inspection history.
        </p>
      </div>

      <Footer />
    </div>
  );
}
