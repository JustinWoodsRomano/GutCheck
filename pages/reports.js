import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { Nav, Footer } from "../components/Layout";
import { loadRestaurants } from "../lib/data";

const SITE = "https://www.gutcheckchicago.com";

export async function getStaticProps() {
  return { props: { total: loadRestaurants().length } };
}

const FAQS = [
  {
    q: "What does a custom report cost?",
    a: "Nothing. The only condition is attribution: cite GutCheck Chicago and include a link to gutcheckchicago.com in whatever you publish.",
  },
  {
    q: "What can you pull that the city's portal can't?",
    a: "The city publishes every inspection as a flat file, which answers questions about one establishment well and questions about patterns badly. We hold the full 313,000-record history in a form that can be grouped, ranked, and compared: repeat-offender lists, neighbourhood comparisons, violation frequency over time, or every establishment matching a specific condition.",
  },
  {
    q: "How long does it take?",
    a: "Usually a day or two. If you're on deadline, say so in the request and include the deadline date.",
  },
  {
    q: "Can I verify the numbers independently?",
    a: "Yes, and you should. Every report cites the inspection ID behind each record plus a direct URL returning that exact row from the city's API. Nothing in a report is a figure you have to take on trust.",
  },
  {
    q: "Do you only work with journalists?",
    a: "No. Researchers, students, community organisations, and public health workers are all welcome. Attribution is the only requirement.",
  },
];

export default function Reports({ total }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    role: "",
    deadline: "",
    details: "",
    honeypot: "",
  });
  const [state, setState] = useState({ status: "idle", message: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setState({ status: "sending", message: "" });
    try {
      const r = await fetch("/api/report-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (r.ok) {
        setState({ status: "sent", message: "" });
      } else {
        setState({
          status: "error",
          message: data.fallback
            ? `${data.error} Email ${data.fallback} directly and I'll pick it up.`
            : data.error || "Something went wrong.",
        });
      }
    } catch {
      setState({
        status: "error",
        message:
          "Couldn't reach the server. Email GutCheckChicago@builtbybackspace.com directly and I'll pick it up.",
      });
    }
  }

  const title = "Custom Chicago Restaurant Inspection Reports for Journalists | GutCheck";
  const description =
    "Free custom reports from Chicago's full food inspection record — repeat offenders, neighbourhood comparisons, violation patterns. Every figure cited to the city's own data. For journalists and researchers.";
  const url = `${SITE}/reports`;

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
      { "@type": "ListItem", position: 1, name: "GutCheck Chicago", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Custom reports", item: url },
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
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE}/og/default.webp`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </Head>

      <Nav total={total} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">GutCheck Chicago</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">Custom reports</span>
      </nav>

      <div className="wrap hero">
        <div className="eyebrow">Free for journalists &amp; researchers</div>
        <h1>CUSTOM INSPECTION REPORTS</h1>
        <p>
          Chicago publishes 313,000 food inspections going back to 2010. That record answers questions
          about one restaurant easily and questions about patterns badly. We hold the whole thing in a
          form that can be grouped, ranked, and compared &mdash; and we&rsquo;ll run it for you.
        </p>
        <p>
          Free. The only condition is that you cite GutCheck Chicago and link to the site in whatever
          you publish.
        </p>
      </div>

      <div className="wrap section">
        <section className="finding">
          <h2>See a sample first</h2>
          <p>
            A full report on one establishment, with every inspection ID and a direct URL returning that
            exact record from the city&rsquo;s API. The establishment name is fictitious; every
            inspection in it is real and verifiable.
          </p>
          <a className="sample-link" href="/gutcheck-sample-report.pdf" target="_blank" rel="noopener">
            <FileText size={17} aria-hidden="true" />
            <span>
              <strong>Sample report (PDF)</strong>
              <em>8 pages · full violation detail · every record cited</em>
            </span>
          </a>
        </section>

        <section className="finding">
          <h2>What we can pull</h2>
          <ul className="method-list">
            <li>
              <strong>Repeat offenders.</strong> Establishments by failure count, citywide or in one
              neighbourhood. 62% of all failures come from 5,254 places that have failed 3+ times.
            </li>
            <li>
              <strong>One establishment&rsquo;s full record.</strong> Every inspection since 2010,
              violation by violation, with the reason each visit happened.
            </li>
            <li>
              <strong>Neighbourhood comparisons.</strong> Pass rates, common violations, and how one
              area sits against the citywide baseline.
            </li>
            <li>
              <strong>Violation patterns.</strong> Which violations actually predict a failure, how
              often specific conditions appear, and how any of it has moved over 16 years.
            </li>
            <li>
              <strong>Anything else the dataset supports.</strong> Describe the question in the form and
              we&rsquo;ll tell you honestly whether the data can answer it.
            </li>
          </ul>
          <p className="hint">
            Some of this is already published on our <Link href="/data">data analysis page</Link>. Start
            there if it covers what you need.
          </p>
        </section>

        <section className="finding" id="request">
          <h2>Request a report</h2>

          {state.status === "sent" ? (
            <div className="form-sent">
              <strong>Request received.</strong> You&rsquo;ll hear back within a day or two, sooner if
              you flagged a deadline.
            </div>
          ) : (
            <div className="report-form">
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Your name *</span>
                  <input type="text" value={form.name} onChange={set("name")} autoComplete="name" />
                </label>
                <label className="field">
                  <span className="field-label">Email *</span>
                  <input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Organization *</span>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={set("organization")}
                    placeholder="Publication, university, agency…"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Role</span>
                  <input
                    type="text"
                    value={form.role}
                    onChange={set("role")}
                    placeholder="Reporter, editor, researcher…"
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Deadline, if you have one</span>
                <input
                  type="text"
                  value={form.deadline}
                  onChange={set("deadline")}
                  placeholder="e.g. Friday 12 September, or none"
                />
              </label>
              <label className="field">
                <span className="field-label">What do you want the report to cover? *</span>
                <textarea
                  rows={7}
                  value={form.details}
                  onChange={set("details")}
                  placeholder="Be as specific as you like — the establishment, neighbourhood, time period, or the question you're trying to answer. If you're not sure what's possible, describe the story and we'll tell you what the data can and can't support."
                />
              </label>

              {/* Bots complete every field they can see; this one is hidden. */}
              <input
                type="text"
                className="hp"
                tabIndex={-1}
                autoComplete="off"
                value={form.honeypot}
                onChange={set("honeypot")}
                aria-hidden="true"
              />

              {state.status === "error" && <div className="form-error">{state.message}</div>}

              <button
                type="button"
                className="form-submit"
                onClick={submit}
                disabled={state.status === "sending"}
              >
                {state.status === "sending" ? "Sending…" : "Send request"}
              </button>
              <p className="hint">
                Goes straight to a person. Prefer email? GutCheckChicago@builtbybackspace.com
              </p>
            </div>
          )}
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
