import Head from "next/head";
import Link from "next/link";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants, loadSlugIndex } from "../lib/data";

const SITE = "https://www.gutcheckchicago.com";

/**
 * Every restaurant and bar whose most recent inspection was a licensing
 * check. Fully server-rendered: this is a directory page, so the entries
 * themselves are the content, and a crawler that never runs JavaScript needs
 * to see all of them.
 *
 * Built at build time rather than fetched client-side because the list is
 * the page -- there is nothing to show while data loads.
 */
export async function getStaticProps() {
  const all = loadRestaurants();
  const total = Object.keys(loadSlugIndex()).length;

  const items = all
    .filter((r) => r.it === "License" && r.n && r.d)
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0))
    .slice(0, 250)
    .map((r) => ({
      slug: r.slug,
      n: r.n,
      g: r.g,
      d: r.d,
      nb: r.vn || r.ca || r.nb,
      nbSlug: r.vnSlug || r.caSlug || r.nbSlug,
    }));

  // Which neighbourhoods are actually seeing new openings -- the genuinely
  // interesting angle, and it earns the page some original copy rather than
  // being a bare list.
  const byHood = {};
  for (const i of items) {
    if (!i.nb) continue;
    byHood[i.nb] = (byHood[i.nb] || 0) + 1;
  }
  const topHoods = Object.entries(byHood)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, slug: items.find((i) => i.nb === name)?.nbSlug }));

  const counts = items.reduce(
    (acc, i) => ({ ...acc, [i.g]: (acc[i.g] || 0) + 1 }),
    {}
  );

  return {
    props: { items, total, topHoods, counts, generated: items[0]?.d || null },
    revalidate: 3600,
  };
}

const GRADE_EMOJI = { PASS: "\u{1F642}", CONDITIONAL: "\u{1F62C}", FAIL: "\u{1F922}" };

export default function NewRestaurants({ items, total, topHoods, counts, generated }) {
  const title = "New Chicago Restaurants & Bars — Health Inspections";
  const description = `${items.length} Chicago restaurants and bars whose most recent health inspection was a new or renewed food licence — the closest public signal to a new opening. Updated from the City of Chicago's live feed.`;
  const url = `${SITE}/new-restaurants`;

  const faqs = [
    {
      q: "How can you tell which Chicago restaurants are new?",
      a: "The City of Chicago records the reason for every inspection. When that reason is a licence inspection, the business is applying for a new food licence or renewing one — usually before it opens to the public. Filtering the city's feed for licence inspections is the closest public signal to a new opening, since the city does not publish an opening-date field.",
    },
    {
      q: "Does a short inspection history mean a restaurant is unsafe?",
      a: "No. A new business simply has not been inspected many times yet. A short record on this page means the establishment is recent, not that it has avoided inspectors.",
    },
    {
      q: "Can a brand-new restaurant fail its first inspection?",
      a: "Yes. Licence inspections are real inspections and can result in a Fail or a Pass with Conditions, most often for equipment, plumbing, or facility issues found before opening. The establishment is normally re-inspected and must pass before operating.",
    },
    {
      q: "How often is this list updated?",
      a: "It rebuilds from the City of Chicago's Food Inspections feed, which the city updates on an ongoing basis. The newest licence inspection currently listed is dated " + (generated || "the most recent city update") + ".",
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
        isBasedOn: "https://data.cityofchicago.org/dataset/Food-Inspections/4ijn-s7e5",
        publisher: { "@id": `${SITE}/#org` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: "New Chicago restaurants and bars",
        numberOfItems: items.length,
        itemListElement: items.slice(0, 100).map((i, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${SITE}/r/${i.slug}`,
          name: i.n,
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
          { "@type": "ListItem", position: 2, name: "New restaurants & bars", item: url },
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
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og/default.webp`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          &larr; Back home
        </Link>
        <div className="eyebrow">New openings &middot; official public data</div>
        <h1>NEW RESTAURANTS &amp; BARS.</h1>

        {/* Answer-first: the question this page exists for, resolved in the
            opening sentence so it can be lifted directly. */}
        <p className="lede">
          These are the {items.length} Chicago restaurants and bars whose most recent
          health inspection was a <strong>licence inspection</strong> — a new or renewed
          food licence, usually filed before the doors open. Chicago does not publish an
          opening-date field, so this is the closest signal the public record offers to a
          new restaurant opening.
        </p>

        <p className="section-note section-note-left">
          Of the {items.length} most recent licence inspections,{" "}
          {counts.PASS || 0} passed, {counts.CONDITIONAL || 0} passed with conditions, and{" "}
          {counts.FAIL || 0} failed. A short inspection record here means the business is
          new — not that it has been avoiding inspectors.
        </p>

        {topHoods.length > 0 && (
          <p className="section-note section-note-left">
            Neighborhoods seeing the most new licences right now:{" "}
            {topHoods.map((h, i) => (
              <span key={h.name}>
                {i > 0 ? ", " : ""}
                {h.slug ? <Link href={`/n/${h.slug}`}>{h.name}</Link> : h.name} ({h.count})
              </span>
            ))}
            .
          </p>
        )}
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">Every new licence inspection, newest first</h2>
        <ul className="nearby-list">
          {items.map((i) => (
            <li key={i.slug} className="nearby-item">
              <Link href={`/r/${i.slug}`} className="nearby-link">
                <span className="nearby-name">{i.n}</span>
                <span className="nearby-meta">
                  {i.nb} &middot; {i.d}
                </span>
                <span className={`nearby-grade nearby-${(i.g || "").toLowerCase()}`}>
                  <span aria-hidden="true">{GRADE_EMOJI[i.g] || ""}</span>{" "}
                  {i.g === "CONDITIONAL" ? "COND" : i.g}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="wrap section">
        <h2 className="eyebrow">New Chicago restaurant inspections FAQ</h2>
        {faqs.map((f) => (
          <div className="faq-item" key={f.q}>
            <p className="faq-q">{f.q}</p>
            <p className="faq-a">{f.a}</p>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
