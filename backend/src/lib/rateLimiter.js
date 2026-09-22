/**
 * NFR-6: "Data collection shall respect source rate limits... and
 * identify itself with a contact address." The contact address is
 * handled by FETCH_USER_AGENT (set in every fetcher's request
 * headers). This file handles the rate-limit half: a minimum spacing
 * between requests to the same named source, enforced in-process.
 *
 * This is intentionally simple — a per-source "don't fire again until
 * N ms have passed since the last one" gate, not a token-bucket or
 * distributed limiter. On Vercel, each cron invocation is a fresh
 * serverless process, so this only throttles *within* a single job
 * run (e.g. the loop across categories/issues inside one cron tick),
 * not across separate cron ticks. That's sufficient for the actual
 * risk here: a job iterating dozens of issues in a tight loop hammering
 * one host, not the 30-minute-apart cron ticks themselves.
 */
const MIN_INTERVAL_MS = {
  "nseindia-subscription": 400,
  "nse-issue-discovery": 400,
  "nse-issue-details": 400,
  "nse-listing-result": 400,
  "investorgain-gmp": 800,
};
const DEFAULT_MIN_INTERVAL_MS = 500;

const lastCallAt = {};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call before every outbound request in a fetcher, keyed by source name. */
async function throttle(source) {
  const minInterval = MIN_INTERVAL_MS[source] ?? DEFAULT_MIN_INTERVAL_MS;
  const last = lastCallAt[source] || 0;
  const elapsed = Date.now() - last;

  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }

  lastCallAt[source] = Date.now();
}

module.exports = { throttle };
