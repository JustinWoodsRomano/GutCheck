/**
 * Notifies IndexNow (Bing, Yandex and other participating engines) about
 * pages that changed in this build.
 *
 * IndexNow is a *freshness* signal, not a bulk-discovery mechanism -- the
 * sitemap already handles the long tail. So this deliberately submits only
 * what plausibly changed: the core browse pages, every neighborhood index,
 * and restaurant pages whose most recent inspection landed inside
 * RECENT_DAYS. Firing all 8,000+ URLs on every deploy would be abusive and
 * risks getting the key throttled or revoked.
 *
 * This must never fail a build. Every failure path logs and exits 0.
 */

import fs from "node:fs";
import path from "node:path";

const KEY = "d7d9c335d03943328e2a5986f8894935";
const HOST = "www.gutcheckchicago.com";
const ORIGIN = `https://${HOST}`;
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Inspections landing inside this window are treated as "changed".
const RECENT_DAYS = 14;
// Hard ceiling regardless of how many recent inspections there are. The
// protocol allows 10,000 per request; staying well under keeps this
// clearly in "notify about changes" territory.
const MAX_URLS = 1500;

function log(msg) {
  console.log(`[indexnow] ${msg}`);
}

async function main() {
  // Preview and local builds must never ping -- they'd be telling search
  // engines that production URLs changed based on non-production content.
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "production") {
    log(`skipped (VERCEL_ENV=${vercelEnv}, only pings on production)`);
    return;
  }
  if (!vercelEnv && !process.env.INDEXNOW_FORCE) {
    log("skipped (not a Vercel build; set INDEXNOW_FORCE=1 to override)");
    return;
  }

  const dataPath = path.resolve("public/data/restaurants.json");
  if (!fs.existsSync(dataPath)) {
    log("skipped (no restaurants.json -- prebuild may have failed)");
    return;
  }

  let restaurants;
  try {
    restaurants = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch (err) {
    log(`skipped (could not parse restaurants.json: ${err.message})`);
    return;
  }
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    log("skipped (restaurants.json empty -- likely a degraded data fetch)");
    return;
  }

  const urls = new Set([
    `${ORIGIN}/`,
    `${ORIGIN}/faq`,
    `${ORIGIN}/hall-of-shame`,
  ]);

  // Every neighborhood index. Small set, and their aggregate stats shift
  // whenever any restaurant inside them is re-inspected.
  for (const nbSlug of new Set(restaurants.map((r) => r.nbSlug).filter(Boolean))) {
    urls.add(`${ORIGIN}/n/${nbSlug}`);
  }

  // Restaurant detail pages with a genuinely recent inspection, newest first
  // so the cap keeps the freshest rather than an arbitrary slice.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = restaurants
    .filter((r) => r.slug && typeof r.d === "string" && r.d >= cutoffStr)
    .sort((a, b) => (a.d < b.d ? 1 : -1));

  for (const r of recent) {
    if (urls.size >= MAX_URLS) break;
    urls.add(`${ORIGIN}/r/${r.slug}`);
  }

  const urlList = [...urls];
  log(
    `submitting ${urlList.length} URLs ` +
      `(${recent.length} restaurants inspected since ${cutoffStr}` +
      `${recent.length > MAX_URLS ? `, capped at ${MAX_URLS}` : ""})`
  );

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
    });

    // 200 = accepted. 202 = accepted, key validation still pending (normal
    // on the very first submission before the key file has been fetched).
    if (res.status === 200 || res.status === 202) {
      log(`accepted (HTTP ${res.status})`);
      return;
    }

    const detail = {
      400: "bad request -- malformed payload",
      403: "forbidden -- key file not found or does not match",
      422: "unprocessable -- URLs do not match host, or key mismatch",
      429: "rate limited -- too many requests",
    }[res.status];
    log(`NOT accepted: HTTP ${res.status}${detail ? ` (${detail})` : ""}`);
  } catch (err) {
    log(`request failed: ${err.message}`);
  }
}

// Belt and braces: nothing in here is worth breaking a deploy over.
main()
  .catch((err) => log(`unexpected error: ${err.message}`))
  .finally(() => process.exit(0));
