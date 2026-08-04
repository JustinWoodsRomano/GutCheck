/**
 * Daily data refresh.
 *
 * Inspection data is baked at build time by scripts/fetch-data.mjs, so
 * "refreshing" means triggering a rebuild rather than revalidating a cache.
 * Vercel Cron calls this route on a schedule and it POSTs to a Deploy Hook,
 * which kicks off a production build that re-pulls from the city.
 *
 * Requires two things set in the Vercel dashboard:
 *   DEPLOY_HOOK_URL  -- Settings > Git > Deploy Hooks, create one on `main`
 *   CRON_SECRET      -- any random string; Vercel sends it as the Bearer
 *                       token on cron invocations
 *
 * Without DEPLOY_HOOK_URL this route is inert and returns 500 rather than
 * failing silently, so a misconfiguration is visible in the logs instead of
 * quietly leaving the data stale.
 */
export default async function handler(req, res) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Reject anything
  // else so the endpoint can't be used to burn build minutes.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) {
    return res.status(500).json({
      error: "DEPLOY_HOOK_URL is not set",
      hint: "Create a Deploy Hook on main in Vercel > Settings > Git, then add it as an env var.",
    });
  }

  try {
    const r = await fetch(hook, { method: "POST" });
    if (!r.ok) {
      return res.status(502).json({ error: `deploy hook returned ${r.status}` });
    }
    return res.status(200).json({
      ok: true,
      triggered: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
