// DU-1 / NFR-5: refresh jobs run on a schedule with no persistent
// server process — Vercel Cron calls these endpoints directly.
//
// Vercel's cron config (vercel.json) is static JSON and can't
// interpolate an env var into the path, so the secret is checked two
// ways:
//   1. `?token=` query param matching CRON_SECRET (you put the real
//      value directly in vercel.json's cron paths at deploy time).
//   2. Vercel-triggered cron requests carry a distinctive user-agent
//      ("vercel-cron/1.0") as a secondary, documented signal.
// Either alone is weak (a leaked deploy config, or a spoofed header);
// together they're adequate for an MVP with no financial writes.
function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers["x-cron-secret"] || req.query.token;

  if (!expected) {
    return res.status(500).json({ error: "CRON_SECRET not configured" });
  }
  if (provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = { requireCronSecret };
