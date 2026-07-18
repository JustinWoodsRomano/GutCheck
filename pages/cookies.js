import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

export async function getStaticProps() {
  const total = loadRestaurants().length;
  return { props: { total } };
}

export default function Cookies({ total }) {
  const title = "Cookie Policy — GutCheck Chicago";
  const description = "What cookies GutCheck Chicago uses and why.";

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
        <link rel="canonical" href="https://gutcheckchicago.com/cookies" />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">Legal</div>
        <h1>COOKIE POLICY.</h1>
      </div>

      <div className="wrap section prose" style={{ maxWidth: 720 }}>
        <p><em>Last updated: July 17, 2026</em></p>

        <p>
          A cookie is a small text file placed on your device when you visit a website. GutCheck
          Chicago is operated by Built By Backspace, LLC. This page
          explains which cookies GutCheck Chicago uses.
        </p>

        <h2>Cookies we don&rsquo;t set</h2>
        <p>
          GutCheck itself doesn&rsquo;t use cookies for accounts, logins, tracking your searches,
          or building a profile of you. There&rsquo;s no login system on this site to begin with.
        </p>

        <h2>Cookies set by advertising (Google AdSense)</h2>
        <p>
          When ads are served on this site through Google AdSense, Google and its advertising
          partners may set cookies on your device, including:
        </p>
        <ul>
          <li>
            <strong>Advertising cookies</strong> &mdash; used by Google and third-party ad vendors
            to serve ads based on your visits to this and other sites, and to measure ad
            performance.
          </li>
          <li>
            <strong>The DoubleClick/Google Ads cookie</strong> &mdash; Google&rsquo;s standard
            cookie for ad serving on publisher sites.
          </li>
        </ul>
        <p>
          These cookies are set by Google, not by GutCheck directly, and are governed by{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
            Google&rsquo;s own cookie and data use policies
          </a>
          .
        </p>

        <h2>Cookies set by hosting infrastructure</h2>
        <p>
          Our hosting provider, Vercel, may use minimal cookies or similar technology necessary
          for basic site operation and security (for example, distinguishing legitimate traffic
          from abuse). These aren&rsquo;t used for advertising or tracking your activity across
          other sites.
        </p>

        <h2>How to control cookies</h2>
        <ul>
          <li>
            Opt out of personalized ads via{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              Google Ads Settings
            </a>
            {" "}or{" "}
            <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              aboutads.info
            </a>
            .
          </li>
          <li>
            Block or delete cookies entirely through your browser&rsquo;s privacy settings.
            Blocking cookies may make ads less relevant but won&rsquo;t affect your ability to
            search or read inspection records on this site.
          </li>
        </ul>

        <h2>Questions</h2>
        <p>
          <a href="mailto:hello@gutcheckchicago.com" style={{ textDecoration: "underline" }}>
            hello@gutcheckchicago.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  );
}
