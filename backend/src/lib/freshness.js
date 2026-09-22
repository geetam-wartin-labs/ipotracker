/**
 * DR-5 / DU-2 / DU-3: staleness thresholds per the requirements table
 * in §5. Every figure on the site carries its own fetch time (FR-12)
 * and must be judged against the threshold for ITS data type, not a
 * single page-level rule.
 *
 * Returned state:
 *   "current" — safe to show as a live value
 *   "warn"    — show the value, but emphasise the fetch time (DU-2)
 *   "stale"   — do NOT present as current; show last-known value +
 *               time + a delay notice instead (DU-3)
 */
const THRESHOLDS_MIN = {
  subscription: { warn: 45, stale: 180 }, // market hours: <45 current, 45-180 warn, >180 stale
  greyMarket: { warn: 240, stale: 720 }, // <4h current, 4-12h warn, >12h stale
  issueDetails: { warn: 36 * 60, stale: 72 * 60 }, // <36h current, 36-72h warn, >72h stale
};

function freshnessState(dataType, fetchedAt, now = new Date()) {
  if (!fetchedAt) return "stale";
  const thresholds = THRESHOLDS_MIN[dataType];
  if (!thresholds) throw new Error(`Unknown data type for freshness check: ${dataType}`);

  const ageMinutes = (now.getTime() - new Date(fetchedAt).getTime()) / 60000;

  if (ageMinutes < thresholds.warn) return "current";
  if (ageMinutes < thresholds.stale) return "warn";
  return "stale";
}

module.exports = { freshnessState, THRESHOLDS_MIN };
