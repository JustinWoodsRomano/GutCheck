/**
 * Report request form handler.
 *
 * Delivery goes through Resend's REST API over plain fetch -- no SDK, so no
 * new dependency in the bundle. Requires RESEND_API_KEY in the environment.
 *
 * When the key is absent the route returns 503 with a mailto fallback rather
 * than pretending to have sent something. A form that silently swallows
 * requests is worse than no form: the requester thinks they've reached
 * someone and hasn't.
 */
const TO = "justin@builtbybackspace.com";
const SUBJECT = "GutCheck Report Request";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { name, email, organization, role, deadline, details, honeypot } = req.body || {};

  // Bots fill every field they find. Real people never see this one.
  if (honeypot) return res.status(200).json({ ok: true });

  if (!name || !email || !organization || !details) {
    return res.status(400).json({
      error: "Name, email, organization, and request details are all required.",
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "That email address doesn't look right." });
  }
  if (String(details).length > 5000) {
    return res.status(400).json({ error: "Request details are too long." });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "The form isn't connected yet.",
      fallback: TO,
    });
  }

  const html = `
    <h2>GutCheck report request</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">
      <tr><td><b>Name</b></td><td>${esc(name)}</td></tr>
      <tr><td><b>Email</b></td><td>${esc(email)}</td></tr>
      <tr><td><b>Organization</b></td><td>${esc(organization)}</td></tr>
      <tr><td><b>Role</b></td><td>${esc(role) || "&mdash;"}</td></tr>
      <tr><td><b>Deadline</b></td><td>${esc(deadline) || "&mdash;"}</td></tr>
    </table>
    <h3>What they're asking for</h3>
    <p style="white-space:pre-wrap;font-family:sans-serif">${esc(details)}</p>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GutCheck Chicago <reports@gutcheckchicago.com>",
        to: [TO],
        reply_to: email,
        subject: SUBJECT,
        html,
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.error("resend failed", r.status, body);
      return res.status(502).json({ error: "Couldn't send that. Try emailing directly.", fallback: TO });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("resend threw", err);
    return res.status(502).json({ error: "Couldn't send that. Try emailing directly.", fallback: TO });
  }
}
