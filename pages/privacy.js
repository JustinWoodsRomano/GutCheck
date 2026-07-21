import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

export async function getStaticProps() {
  const total = loadRestaurants().length;
  return { props: { total } };
}

export default function Privacy({ total }) {
  const title = "Privacy Policy — GutCheck Chicago";
  const description = "How GutCheck Chicago handles data, cookies, and advertising.";

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
        <link rel="canonical" href="https://gutcheckchicago.com/privacy" />
      </Head>

      <Nav total={total} />

      <div className="wrap hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back home
        </Link>
        <div className="eyebrow">Legal</div>
        <h1>PRIVACY POLICY.</h1>
      </div>

      <div className="wrap section prose" style={{ maxWidth: 720 }}>
        <p><em>Last updated: July 17, 2026</em></p>

        <p>
          GutCheck Chicago (&ldquo;GutCheck&rdquo;) is operated by Built By Backspace, LLC
          (&ldquo;Built By Backspace,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;). GutCheck
          doesn&rsquo;t require an
          account, and we don&rsquo;t ask you for personal information to use the site. This
          policy explains what limited data is collected, mainly through hosting infrastructure
          and advertising, and how it&rsquo;s used.
        </p>

        <h2>1. Information we collect directly</h2>
        <p>
          We don&rsquo;t operate user accounts, logins, or forms that collect personal
          information. If you email us, we&rsquo;ll have whatever information you choose to
          include in that email, used only to respond to you.
        </p>

        <h2>2. Information collected automatically</h2>
        <p>
          Like virtually every website, our hosting provider (Vercel) automatically logs standard
          technical information for security and performance purposes when you visit &mdash;
          things like IP address, browser type, device type, referring page, and timestamps. We
          don&rsquo;t use this to build individual profiles of visitors.
        </p>

        <h2>3. Cookies and advertising (Google AdSense)</h2>
        <p>
          GutCheck displays ads served through Google AdSense. As required by Google&rsquo;s
          publisher policies, we disclose the following:
        </p>
        <ul>
          <li>
            Third-party vendors, including Google, use cookies to serve ads on this site based on
            a user&rsquo;s prior visits to this or other websites.
          </li>
          <li>
            Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to
            you based on your visits to this site and other sites on the internet.
          </li>
          <li>
            You may opt out of personalized advertising by visiting{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              Google Ads Settings
            </a>
            . You can also opt out of a third-party vendor&rsquo;s use of cookies for
            interest-based advertising by visiting{" "}
            <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
              aboutads.info
            </a>
            .
          </li>
        </ul>
        <p>
          See our separate <Link href="/cookies" style={{ textDecoration: "underline" }}>Cookie
          Policy</Link> for more detail on what cookies are set and why.
        </p>

        <h2>4. Data about restaurants shown on this site</h2>
        <p>
          Restaurant names, addresses, and inspection results displayed on GutCheck are public
          records sourced from the City of Chicago&rsquo;s Food Inspections open-data feed
          (data.cityofchicago.org, dataset 4ijn-s7e5). This is government-published public data,
          not personal data we&rsquo;ve collected, and is governed by the City of Chicago&rsquo;s
          own data disclaimers, not this policy.
        </p>

        <h2>5. Children&rsquo;s privacy</h2>
        <p>
          GutCheck isn&rsquo;t directed at children under 13, and we don&rsquo;t knowingly collect
          personal information from children.
        </p>

        <h2>6. Your choices</h2>
        <p>
          You can control cookies through your browser settings, and opt out of personalized
          advertising using the links in Section 3. Blocking cookies may affect how ads display
          but won&rsquo;t affect your ability to browse inspection records.
        </p>

        <h2>7. Changes to this policy</h2>
        <p>
          We may update this policy as the site or applicable law changes. We&rsquo;ll update the
          date at the top when we do.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href="mailto:GutCheckChicago@builtbybackspace.com" style={{ textDecoration: "underline" }}>
            GutCheckChicago@builtbybackspace.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  );
}
