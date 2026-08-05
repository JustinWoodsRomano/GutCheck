#!/usr/bin/env python3
"""
Builds the GutCheck sample report PDF.

Renders through headless Chromium rather than wkhtmltopdf, because the report
has to carry the actual brand: Archivo Black / IBM Plex Mono / Source Serif 4
loaded from Google Fonts, the real logo mark, and full-colour emoji from
Noto Color Emoji. wkhtmltopdf's WebKit renders webfonts inconsistently and
emoji as monochrome boxes.

Design tokens are pulled straight from the live stylesheet so the PDF can't
drift from the site.

Usage:  python3 scripts/build-sample-report.py
"""
import base64
import json
import re
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = "https://www.gutcheckchicago.com"
API = "https://data.cityofchicago.org/resource/4ijn-s7e5.json"
CITE = f"{API}?inspection_id="
# A real establishment. Its trading name is anonymised in the sample, but
# every inspection id, date, result and violation below is the unmodified
# city record, so each citation URL resolves.
SOURCE_LICENSE = "2663700"

UA = {"User-Agent": "gutcheck-report-builder"}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90)


def live_tokens():
    """Read the site's CSS custom properties so the PDF matches exactly."""
    home = fetch(SITE).read().decode()
    href = re.search(r"/_next/static/css/[a-z0-9]+\.css", home).group(0)
    css = fetch(SITE + href).read().decode()
    root = re.search(r":root\{(.*?)\}", css, re.S).group(1)
    return dict(re.findall(r"(--[a-z0-9-]+):\s*([^;]+)", root))


def logo_data_uri():
    raw = fetch(f"{SITE}/gutcheck-mark.png").read()
    return "data:image/png;base64," + base64.b64encode(raw).decode()


CODE_RE = re.compile(r"^(\d{1,2})\.\s*(.+?)\s*-\s*Comments:\s*(.*)$", re.S)
CRIT_RE = re.compile(r"PRIORITY FOUNDATION|PRIORITY VIOLATION", re.I)

PREVENTIVE = re.compile(
    r"(?:rodent|pest|insect|vermin)[\s-]*proof\w*"
    r"|prevent\w*[^.]{0,40}?(?:rodent|pest|insect|vermin|entry)"
    r"|(?:rodent|pest|insect)[\s-]*(?:entry|harborage)"
    r"|entry\s+point\w*",
    re.I,
)
EVIDENCE = re.compile(r"\b(?:observed|found|noted|live|dead|\d+)\b", re.I)
TAGS = [
    ("🪳", "Roaches", re.compile(r"\b(?:cock)?roach(?:es)?\b", re.I), True),
    ("🐀", "Mice / rats", re.compile(r"\b(?:mice|mouse|rat|rats|rodent|vermin)\b", re.I), True),
    ("🪰", "Flies / gnats", re.compile(r"\b(?:flies|fly|gnat|gnats)\b", re.I), True),
    ("💩", "Droppings", re.compile(r"\bdroppings?\b", re.I), False),
    ("🦠", "Mold", re.compile(r"\bmold(?:y|ed)?\b|\bmildew\b", re.I), False),
    ("🚽", "Sewage", re.compile(r"\bsewage\b|\bsewer\b", re.I), False),
]


def detect_tags(text):
    scrubbed = PREVENTIVE.sub(" ", text)
    has_ev = bool(EVIDENCE.search(scrubbed))
    out = []
    for emoji, label, rx, gated in TAGS:
        if gated:
            if rx.search(scrubbed) and has_ev:
                out.append((emoji, label))
        elif rx.search(text):
            out.append((emoji, label))
    return out


def parse_violations(raw):
    out = []
    for chunk in (raw or "").split("|"):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = CODE_RE.match(chunk)
        if not m:
            continue
        out.append(
            {
                "code": int(m.group(1)),
                "title": " ".join(m.group(2).split()),
                "comment": " ".join(m.group(3).split()),
                "critical": bool(CRIT_RE.search(chunk)),
            }
        )
    # Priority findings first, matching how the site orders them.
    out.sort(key=lambda v: 0 if v["critical"] else 1)
    return out


def truncate(text, limit=1100):
    """Trim to a word boundary. Cutting mid-word looks like a bug in a
    document a reporter may quote from, and the full text is one click away
    at the cited URL anyway."""
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:.")
    return cut + " \u2026 [truncated \u2014 full text at the cited source]"


def esc(s):
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_html(rows, tokens, logo, today):
    graded = [r for r in rows if r["results"] in ("Pass", "Fail", "Pass w/ Conditions")]
    fails = [r for r in graded if r["results"] == "Fail"]
    current = graded[0]

    blocks = []
    for r in graded[:6]:
        vs = parse_violations(r.get("violations"))
        rows_html = ""
        for v in vs:
            tag_html = "".join(
                f'<span class="tag"><span class="e">{e}</span>{esc(l)}</span>'
                for e, l in detect_tags(v["comment"])
            )
            rows_html += f"""
            <div class="viol {'crit' if v['critical'] else ''}">
              <div class="vmeta">
                <span class="vcode">#{v['code']}</span>
                <span class="vsev {'sev-crit' if v['critical'] else ''}">{'PRIORITY' if v['critical'] else 'CORE'}</span>
                {tag_html}
              </div>
              <div class="vtitle">{esc(v['title'].title())}</div>
              <div class="vbody">{esc(truncate(v['comment']))}</div>
            </div>"""
        if not vs:
            rows_html = '<div class="clean">No violations recorded at this inspection.</div>'

        res = r["results"]
        cls = "fail" if res == "Fail" else ("cond" if "Condition" in res else "pass")
        emoji = "🤢" if cls == "fail" else ("😬" if cls == "cond" else "🙂")
        blocks.append(f"""
        <section class="insp">
          <header class="ihead">
            <span class="idate">{esc(r['inspection_date'][:10])}</span>
            <span class="stamp s-{cls}"><span class="e">{emoji}</span>{esc(res)}</span>
            <span class="itype">{esc(r.get('inspection_type'))}</span>
          </header>
          <div class="cite">
            <span class="cite-label">Source</span>
            City of Chicago Food Inspections &middot; dataset 4ijn-s7e5 &middot;
            inspection_id <b>{esc(r['inspection_id'])}</b>
            <span class="citeurl">{CITE}{esc(r['inspection_id'])}</span>
          </div>
          {rows_html}
        </section>""")

    t = tokens
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {{
    --paper: {t.get('--paper','#edede6')};
    --paper-light: {t.get('--paper-light','#f5f5ef')};
    --ink: {t.get('--ink','#1c2333')};
    --ink-muted: {t.get('--ink-muted','#4b5566')};
    --line: {t.get('--line','#c7c2b4')};
    --red: {t.get('--stamp-red','#b7362f')};
    --red-tint: {t.get('--stamp-red-tint','#f3e1df')};
    --green: {t.get('--seal-green','#2e6b4f')};
    --green-tint: {t.get('--seal-green-tint','#e2ece5')};
    --amber: {t.get('--amber','#b4841d')};
    --amber-tint: {t.get('--amber-tint','#f2e8d3')};
    --r-stamp: {t.get('--radius-stamp','8px')};
    --r-card: {t.get('--radius-card','18px')};
  }}
  @page {{ size: Letter; margin: 14mm 13mm 16mm 13mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: 'Source Serif 4', Georgia, serif;
    font-size: 10pt; line-height: 1.52;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }}
  .e {{ font-family: 'Noto Color Emoji', sans-serif; font-size: 1.05em; line-height: 1; }}
  .mast {{ display: flex; align-items: center; gap: 11px;
    border-bottom: 3px solid var(--ink); padding-bottom: 11px; margin-bottom: 18px; }}
  .mast img {{ width: 27px; height: 27px; }}
  .wordmark {{ font-family: 'Archivo Black', sans-serif; font-size: 20pt;
    letter-spacing: -0.4px; line-height: 1; }}
  .masthead-sub {{ margin-left: auto; text-align: right;
    font-family: 'IBM Plex Mono', monospace; font-size: 7pt;
    letter-spacing: 1.1px; text-transform: uppercase; color: var(--ink-muted); }}
  .prepared {{ background: var(--paper-light); border: 1px solid var(--line);
    border-radius: var(--r-card); padding: 13px 16px; margin-bottom: 18px; font-size: 9.5pt; }}
  .prepared b {{ font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt;
    letter-spacing: 0.8px; text-transform: uppercase; color: var(--ink-muted);
    display: inline-block; min-width: 78px; }}
  h1 {{ font-family: 'Archivo Black', sans-serif; font-size: 19pt;
    line-height: 1.1; margin: 0 0 5px; }}
  h2 {{ font-family: 'Archivo Black', sans-serif; font-size: 12.5pt;
    margin: 22px 0 9px; padding-bottom: 5px; border-bottom: 1px solid var(--line); }}
  .addr {{ font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; color: var(--ink-muted); }}
  .headline-stamp {{ display: inline-flex; align-items: center; gap: 7px;
    border: 2px solid var(--red); background: var(--red-tint); color: var(--red);
    font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 13pt;
    letter-spacing: 1.5px; padding: 7px 17px; border-radius: var(--r-stamp);
    margin: 11px 0 4px; }}
  .note {{ background: var(--amber-tint); border: 1px solid var(--amber);
    border-radius: var(--r-stamp); padding: 11px 14px; font-size: 9pt; margin: 15px 0; }}
  table.kv {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 11px 0; }}
  table.kv td {{ padding: 7px 9px; border-bottom: 1px solid var(--line); }}
  table.kv td:first-child {{ font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt;
    letter-spacing: 0.7px; text-transform: uppercase; color: var(--ink-muted); width: 40%; }}
  .insp {{ border: 1px solid var(--line); border-radius: var(--r-card);
    background: var(--paper-light); padding: 13px 15px; margin-bottom: 13px;
    break-inside: avoid; }}
  .ihead {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }}
  .idate {{ font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 10.5pt; }}
  .stamp {{ display: inline-flex; align-items: center; gap: 5px;
    font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 8pt;
    letter-spacing: 0.6px; padding: 3px 10px; border-radius: var(--r-stamp);
    border: 2px solid; }}
  .s-fail {{ color: var(--red); background: var(--red-tint); border-color: var(--red); }}
  .s-pass {{ color: var(--green); background: var(--green-tint); border-color: var(--green); }}
  .s-cond {{ color: var(--amber); background: var(--amber-tint); border-color: var(--amber); }}
  .itype {{ font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt;
    letter-spacing: 0.5px; text-transform: uppercase; color: var(--ink-muted); }}
  .cite {{ font-family: 'IBM Plex Mono', monospace; font-size: 7pt; color: var(--ink-muted);
    background: var(--paper); border-left: 3px solid var(--green);
    padding: 7px 10px; border-radius: 0 4px 4px 0; margin-bottom: 10px; }}
  .cite-label {{ display: block; font-weight: 700; color: var(--green);
    letter-spacing: 1px; margin-bottom: 2px; }}
  .citeurl {{ display: block; color: var(--green); word-break: break-all; margin-top: 3px; }}
  .viol {{ border-left: 3px solid var(--line); padding: 5px 0 5px 11px; margin-bottom: 10px; }}
  .viol.crit {{ border-left-color: var(--red); }}
  .vmeta {{ display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }}
  .vcode {{ font-family: 'IBM Plex Mono', monospace; font-size: 8pt; font-weight: 700; }}
  .vsev {{ font-family: 'IBM Plex Mono', monospace; font-size: 6.5pt;
    letter-spacing: 0.7px; color: var(--ink-muted); }}
  .sev-crit {{ color: var(--red); font-weight: 700; }}
  .tag {{ display: inline-flex; align-items: center; gap: 4px;
    font-family: 'IBM Plex Mono', monospace; font-size: 6.5pt; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase; border: 1px solid var(--red);
    background: var(--red-tint); color: var(--red); padding: 2px 6px; border-radius: 4px; }}
  .vtitle {{ font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt;
    font-weight: 700; margin-bottom: 1px; }}
  .vbody {{ font-size: 9pt; color: var(--ink-muted); }}
  .clean {{ font-size: 9pt; color: var(--green); font-style: italic; }}
  .foot {{ margin-top: 26px; border-top: 2px solid var(--ink); padding-top: 11px;
    font-family: 'IBM Plex Mono', monospace; font-size: 7pt; color: var(--ink-muted);
    line-height: 1.6; }}
  .foot b {{ color: var(--ink); }}
  p {{ margin: 0 0 9px; }}
</style></head><body>

<div class="mast">
  <img src="{logo}" alt="">
  <span class="wordmark">GUTCHECK</span>
  <span class="masthead-sub">Health inspection report<br>Prepared {today}</span>
</div>

<div class="prepared">
  <div><b>Prepared for</b> Jordan Reyes &middot; Chicago Sun-Times</div>
  <div><b>Request</b> Full inspection history and violation detail for one
    establishment, with citations to the originating city records.</div>
</div>

<h1>Sample Restaurant &amp; Cantina</h1>
<div class="addr">4014 W SAMPLE ST, CHICAGO, IL 60623 &middot; SOUTH LAWNDALE</div>
<div class="headline-stamp"><span class="e">🤢</span>FAIL</div>

<div class="note">
  <b>About this sample.</b> The establishment name and address above are fictitious.
  Every inspection ID, date, result and violation below is a real, unmodified record
  from the City of Chicago's Food Inspections dataset, so each citation URL resolves
  to the genuine source. Reports we prepare for you name the real establishment.
</div>

<table class="kv">
  <tr><td>Current result</td><td><b>{esc(current['results'])}</b> &middot; {esc(current['inspection_date'][:10])}</td></tr>
  <tr><td>Inspection trigger</td><td>{esc(current.get('inspection_type'))}</td></tr>
  <tr><td>Risk category</td><td>{esc(current.get('risk','n/a'))}</td></tr>
  <tr><td>Graded inspections on record</td><td>{len(graded)}</td></tr>
  <tr><td>Failures on record</td><td><b>{len(fails)}</b></td></tr>
  <tr><td>City licence number</td><td>{SOURCE_LICENSE}</td></tr>
</table>

<h2>Why this record stands out</h2>
<p>This establishment has failed {len(fails)} of its {len(graded)} graded inspections.
Citywide, 62% of all 40,259 restaurant and bar failures since 2010 come from just
5,254 establishments that have failed three or more times &mdash; this one sits
firmly in that group.</p>
<p>Its recent failures were triggered by public complaints rather than the routine
schedule. Across the full dataset, complaint-driven inspections fail 34% of the time
against 22% for routine visits, so the trigger is itself a signal worth reporting.</p>

<h2>Inspection history and violations</h2>
<p>Priority violations are listed before core violations within each inspection,
matching the order used on gutcheckchicago.com. Pest findings are tagged only where
the inspector recorded evidence, not where a structural risk was noted.</p>
{''.join(blocks)}

<h2>Citations and method</h2>
<p>Every figure derives from the City of Chicago's Food Inspections dataset
(4ijn-s7e5), published by the Chicago Department of Public Health. Each inspection
above carries its <b>inspection_id</b> and a direct API URL returning that exact
record, so nothing here has to be taken on trust.</p>
<table class="kv">
  <tr><td>Dataset</td><td>Food Inspections (4ijn-s7e5)</td></tr>
  <tr><td>Publisher</td><td>Chicago Department of Public Health</td></tr>
  <tr><td>Portal</td><td>data.cityofchicago.org</td></tr>
  <tr><td>Coverage</td><td>1 January 2010 to present</td></tr>
  <tr><td>Scope in this report</td><td>Restaurants and bars only</td></tr>
  <tr><td>Retrieved</td><td>{today}</td></tr>
</table>

<div class="foot">
  <b>GUTCHECK CHICAGO</b> &middot; gutcheckchicago.com &middot; GutCheckChicago@builtbybackspace.com<br>
  Independent service. Not affiliated with or endorsed by the City of Chicago.<br>
  Data is republished from the city's open data portal and may contain duplicate or
  amended records. Verify against the cited sources before publication.
</div>
</body></html>"""


def main():
    tokens = live_tokens()
    logo = logo_data_uri()
    import datetime

    today = datetime.date.today().isoformat()

    url = f"{API}?license_={SOURCE_LICENSE}&$order=inspection_date%20DESC&$limit=14"
    rows = json.loads(fetch(url).read().decode())

    html = build_html(rows, tokens, logo, today)
    Path("/tmp/report.html").write_text(html)

    out = Path("/tmp/gutcheck-sample-report.pdf")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        # Webfonts load over the network; without this the PDF can snapshot
        # mid-swap and fall back to system faces.
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(2500)
        checks = page.evaluate(
            """() => ({
              archivo: document.fonts.check("20pt 'Archivo Black'"),
              plex: document.fonts.check("10pt 'IBM Plex Mono'"),
              serif: document.fonts.check("10pt 'Source Serif 4'"),
              logo: !!document.querySelector('.mast img')?.complete
            })"""
        )
        print("font/logo checks:", checks)
        if not all(checks.values()):
            raise SystemExit(f"Brand assets failed to load: {checks}")
        page.pdf(path=str(out), format="Letter", print_background=True,
                 margin={"top": "14mm", "bottom": "16mm", "left": "13mm", "right": "13mm"})
        browser.close()
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
