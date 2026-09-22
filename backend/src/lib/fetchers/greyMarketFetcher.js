const axios = require("axios");
const cheerio = require("cheerio");
const gmpNameMapping = require("../../data/gmpNameMapping.json");
const { isAllowedByRobots } = require("../robotsCheck");

const GMP_ORIGIN = "https://www.investorgain.com";
const GMP_PATH = "/report/live-ipo-gmp/331/";
const SOURCE_URL = `${GMP_ORIGIN}${GMP_PATH}`;

/**
 * LIVE fetcher, verified against a real captured table (22 Sep 2026).
 * Two things fixed from the original guess after seeing the real
 * HTML:
 *
 *   1. Row matching now uses the GMP-page slug from each row's
 *      <a href="/gmp/<slug>/"> (via ../../data/gmpNameMapping.json),
 *      not a free-text company-name substring match. The slug is
 *      stable and unambiguous; the earlier text-match approach risked
 *      matching the wrong row for similarly-named companies.
 *
 *   2. The GMP value is in the SECOND <td> (index 1: Name=0, GMP=1,
 *      Rating=2, Sub=3, ...), not index 2 as originally guessed —
 *      that guess was made before any real table markup had been
 *      seen. The value itself sits inside a <b> tag, e.g.
 *      `₹<b>3</b> (2.03%)`; a placeholder of "--" means no GMP
 *      recorded yet (treated as "nothing new," not an error), and
 *      negative values like `₹<b>-3</b> (-3.57%)` do occur.
 *
 *   The table also has periodic repeated-header <tr> rows with no
 *   `data-label="Name"` cell — those are skipped by only iterating
 *   rows that actually have one.
 */
async function fetchGreyMarketPremium(issue, previousValue) {
  const slug = gmpNameMapping[issue.tradingSymbol];
  if (!slug) return null; // no audited mapping entry — don't guess

  if (!(await isAllowedByRobots(GMP_ORIGIN, GMP_PATH))) {
    throw new Error(`Fetch blocked by robots.txt: ${SOURCE_URL}`);
  }

  const res = await axios.get(SOURCE_URL, {
    headers: { "User-Agent": process.env.FETCH_USER_AGENT },
  });
  const $ = cheerio.load(res.data);

  let premiumAmount = null;
  let impliedGainPercent = null;

  $("tr").each((_, row) => {
    if (premiumAmount !== null) return; // already found
    const nameCell = $(row).find('td[data-label="Name"]');
    if (nameCell.length === 0) return; // repeated-header row, skip

    const href = nameCell.find("a").attr("href") || "";
    if (!href.includes(slug)) return;

    const gmpCell = $(row).find('td[data-label="GMP"]');
    const boldText = gmpCell.find("b").first().text().trim();
    const fullText = gmpCell.text();

    if (boldText && boldText !== "--") {
      const value = Number(boldText.replace(/,/g, ""));
      if (!Number.isNaN(value)) premiumAmount = value;
    }

    const pctMatch = fullText.match(/\(\s*(-?[\d.]+)\s*%\s*\)/);
    if (pctMatch) {
      const pct = Number(pctMatch[1]);
      if (!Number.isNaN(pct)) impliedGainPercent = pct;
    }
  });

  if (premiumAmount === null) return null; // "--" placeholder or row not found

  // Prefer the page's own percentage if we got it; otherwise derive
  // from the price band as a fallback.
  if (impliedGainPercent === null) {
    impliedGainPercent = Number(
      ((premiumAmount / issue.priceBandMax) * 100).toFixed(2)
    );
  }

  return { premiumAmount, impliedGainPercent, sourceUrl: SOURCE_URL };
}

module.exports = { fetchGreyMarketPremium };
