import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

export async function getStaticProps() {
  const total = loadRestaurants().length;
  return { props: { total } };
}

export default function Terms({ total }) {
  const title = "Terms of Service — GutCheck Chicago";
  const description = "The terms governing your use of GutCheck Chicago.";

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
        <link rel="canonical" href="https://gutcheckchicago.com/terms" />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">Legal</div>
        <h1>TERMS OF SERVICE.</h1>
      </div>

      <div className="wrap section prose" style={{ maxWidth: 720 }}>
        <p><em>Last updated: July 17, 2026</em></p>

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of GutCheck Chicago,
          available at gutcheckchicago.com. GutCheck Chicago is operated by Built By Backspace,
          LLC (&ldquo;Built By Backspace,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;). By using
          this site, you agree to these Terms. If you don&rsquo;t agree, please don&rsquo;t use the site.
        </p>

        <h2>1. What GutCheck is</h2>
        <p>
          GutCheck is an independent, informational tool that reorganizes publicly available City
          of Chicago health inspection records into a searchable format. We are not affiliated
          with, endorsed by, or operated on behalf of the City of Chicago, Cook County, the
          Chicago Department of Public Health, or any restaurant listed on this site.
        </p>

        <h2>2. No warranty on data accuracy</h2>
        <p>
          Inspection data is sourced directly from the City of Chicago&rsquo;s public Food
          Inspections open-data feed and is rebuilt from that live feed on every deployment. We do
          not independently verify, conduct, or influence inspections. Data may be incomplete,
          delayed, outdated, or contain errors introduced by the source or by our processing.
          Violations reflect conditions observed at a single point in time and are not a guarantee
          of a restaurant&rsquo;s current or future condition. <strong>GutCheck is provided
          &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, express or
          implied</strong>, including accuracy, completeness, or fitness for a particular purpose.
        </p>

        <h2>3. Not a substitute for official records</h2>
        <p>
          For legal, business, or official purposes, always consult the City of Chicago&rsquo;s
          official records directly. Do not rely on GutCheck as the sole basis for decisions
          where accuracy is critical.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Scrape, bulk-extract, or systematically republish site content in a way that
          misrepresents its source or omits this disclaimer;</li>
          <li>Use the site to harass, defame, or make false statements about any listed
          restaurant beyond what the official data itself reflects;</li>
          <li>Attempt to disrupt, overload, or gain unauthorized access to the site or its
          underlying systems;</li>
          <li>Use the site in any way that violates applicable law.</li>
        </ul>

        <h2>5. Advertising</h2>
        <p>
          GutCheck is supported by advertising, including ads served through Google AdSense.
          Third-party advertisers and ad networks may use cookies and similar technologies as
          described in our <Link href="/privacy" style={{ textDecoration: "underline" }}>Privacy
          Policy</Link>. We don&rsquo;t control the content of individual ads and aren&rsquo;t
          responsible for the products, services, or claims of advertisers.
        </p>

        <h2>6. Third-party links</h2>
        <p>
          The site links to third-party services (Google Maps, the City of Chicago&rsquo;s open
          data portal, and others). We aren&rsquo;t responsible for the content, accuracy, or
          practices of sites we don&rsquo;t operate.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, GutCheck and its operators aren&rsquo;t liable
          for any indirect, incidental, or consequential damages arising from your use of, or
          inability to use, the site, including decisions made in reliance on data displayed here.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these Terms as the site evolves. Continued use after changes are posted
          means you accept the updated Terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:GutCheckChicago@builtbybackspace.com" style={{ textDecoration: "underline" }}>
            GutCheckChicago@builtbybackspace.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  );
}
