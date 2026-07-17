import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

const SANITY_QUERY_URL =
  "https://5kywyk09.api.sanity.io/v2024-01-01/data/query/production?query=" +
  encodeURIComponent('*[_type=="faqItem"]|order(category,order){question,answer,category,order}');

export async function getStaticProps() {
  const total = loadRestaurants().length;
  let faqs = [];
  try {
    const res = await fetch(SANITY_QUERY_URL);
    const json = await res.json();
    faqs = json.result || [];
  } catch (e) {
    faqs = [];
  }
  return { props: { faqs, total }, revalidate: false };
}

const CATEGORY_LABEL = { grading: "Grading System", data: "Data & Sourcing", usage: "Using GutCheck" };

export default function FAQPage({ faqs, total }) {
  const title = "FAQ — How Chicago Restaurant Health Inspections Work | GutCheck";
  const description =
    "Answers to common questions about Chicago's restaurant health inspection grading system, GutCheck's data source, and how to use the site.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const grouped = faqs.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

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
        <link rel="canonical" href="https://gutcheckchicago.com/faq" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">Frequently asked questions</div>
        <h1>HOW IT WORKS.</h1>
        <p>Straight answers about Chicago&rsquo;s inspection grading system and where this data comes from.</p>
      </div>

      <div className="wrap section" style={{ maxWidth: 760 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 32 }}>
            <div className="eyebrow">{CATEGORY_LABEL[cat] || cat}</div>
            {items.map((f, i) => (
              <div className="faq-item" key={i}>
                <h2 className="faq-q">{f.question}</h2>
                <p className="faq-a">{f.answer}</p>
              </div>
            ))}
          </div>
        ))}
        {faqs.length === 0 && <p className="prose">FAQ content is loading — check back shortly.</p>}
      </div>

      <Footer />
    </div>
  );
}
