const axios = require("axios");
const { getNseCookies } = require("../nseSession");
const { isAllowedByRobots } = require("../robotsCheck");
const { parseSubscriptionForCategory } = require("./nseIpoDetailParser");

const NSE_ORIGIN = "https://www.nseindia.com";

/**
 * LIVE fetcher, field names verified against a real captured response
 * (see ./nseIpoDetailParser.js's header comment) — this is no longer
 * a guess. Returns null when the category has no data yet (e.g. an
 * employee reservation that doesn't exist for this IPO) — that's
 * "nothing new from the source," not a failure.
 */
async function fetchSubscription(issue, category, previousValue) {
  const path = "/api/ipo-detail";
  if (!(await isAllowedByRobots(NSE_ORIGIN, path))) {
    throw new Error(`Fetch blocked by robots.txt: ${NSE_ORIGIN}${path}`);
  }

  const cookies = await getNseCookies();
  const series = issue.issueType === "sme" ? "SME" : "EQ";
  const sourceUrl = `${NSE_ORIGIN}${path}?symbol=${encodeURIComponent(
    issue.tradingSymbol
  )}&series=${series}`;

  const res = await axios.get(sourceUrl, {
    headers: { "User-Agent": process.env.FETCH_USER_AGENT, Cookie: cookies },
  });

  const parsed = parseSubscriptionForCategory(res.data, category);
  if (!parsed) return null;

  return { timesSubscribed: parsed.timesSubscribed, sourceUrl };
}

module.exports = { fetchSubscription };
