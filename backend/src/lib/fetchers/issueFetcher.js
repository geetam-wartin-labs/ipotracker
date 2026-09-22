const axios = require("axios");
const { getNseCookies } = require("../nseSession");
const { isAllowedByRobots } = require("../robotsCheck");
const { parseIssueDetailFields } = require("./nseIpoDetailParser");

const NSE_ORIGIN = "https://www.nseindia.com";

/**
 * "DD-Mon-YYYY" (e.g. "22-Sep-2026") -> Date | null.
 * NSE's discovery endpoint uses this format, not ISO — new Date()
 * does NOT reliably parse it across environments, so it's parsed
 * explicitly rather than trusted to the Date constructor.
 */
const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
function parseNseDate(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (month === undefined) return null;
  return new Date(Date.UTC(year, month, day));
}

/**
 * GET /api/all-upcoming-issues?category=ipo — verified shape (22 Sep
 * 2026 capture). Sparser than originally assumed: no ISIN, price is
 * a string range, issueSize is a raw share count (not ₹ crore), no
 * registrar, and mainboard rows have no lot size at all (only SME
 * rows carry "lotSize"). This alone is NOT enough to build a full
 * Issue record — see fetchNewAndUpcomingIssues below, which enriches
 * each new row with a second call to ipo-detail.
 */
async function fetchDiscoveryList() {
  const path = "/api/all-upcoming-issues";
  if (!(await isAllowedByRobots(NSE_ORIGIN, path))) {
    throw new Error(`Fetch blocked by robots.txt: ${NSE_ORIGIN}${path}`);
  }

  const cookies = await getNseCookies();
  const res = await axios.get(`${NSE_ORIGIN}${path}?category=ipo`, {
    headers: { "User-Agent": process.env.FETCH_USER_AGENT, Cookie: cookies },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** "Rs.140 to Rs.148" -> { min: 140, max: 148 } | null (discovery-endpoint format, no space after "Rs.") */
function parseDiscoveryPriceRange(str) {
  if (!str) return null;
  const match = String(str).match(/Rs\.?\s*([\d,.]+)\s*to\s*Rs\.?\s*([\d,.]+)/i);
  if (!match) return null;
  const min = Number(match[1].replace(/,/g, ""));
  const max = Number(match[2].replace(/,/g, ""));
  return Number.isNaN(min) || Number.isNaN(max) ? null : { min, max };
}

async function fetchIpoDetailRaw(tradingSymbol, series) {
  const path = "/api/ipo-detail";
  if (!(await isAllowedByRobots(NSE_ORIGIN, path))) {
    throw new Error(`Fetch blocked by robots.txt: ${NSE_ORIGIN}${path}`);
  }
  const cookies = await getNseCookies();
  const res = await axios.get(
    `${NSE_ORIGIN}${path}?symbol=${encodeURIComponent(tradingSymbol)}&series=${series}`,
    { headers: { "User-Agent": process.env.FETCH_USER_AGENT, Cookie: cookies } }
  );
  return res.data;
}

/**
 * Discovery + enrichment. For each row not already in our DB, fetch
 * the full ipo-detail response too, so the returned payload has
 * everything Issue requires (registrar, face value, confirmed price
 * band) rather than just what the sparse discovery row provides.
 *
 * A row that can't be enriched with all REQUIRED Issue fields
 * (price band, lot size, face value, registrar) is skipped and
 * logged by the caller (jobs/refreshIssues.js already does this via
 * validateIssueDates/validatePriceBand) — never inserted with a
 * guessed value.
 */
async function fetchNewAndUpcomingIssues() {
  const rows = await fetchDiscoveryList();
  const payloads = [];

  for (const row of rows) {
    if (!row.symbol) continue;

    const series = row.series === "SME" ? "SME" : "EQ";
    const discoveryPrice = parseDiscoveryPriceRange(row.issuePrice);
    const openDate = parseNseDate(row.issueStartDate);
    const closeDate = parseNseDate(row.issueEndDate);

    let detailFields = {};
    let sourceUrl = `${NSE_ORIGIN}/api/all-upcoming-issues?category=ipo`;
    try {
      const raw = await fetchIpoDetailRaw(row.symbol, series);
      detailFields = parseIssueDetailFields(raw);
      sourceUrl = `${NSE_ORIGIN}/api/ipo-detail?symbol=${row.symbol}&series=${series}`;
    } catch (err) {
      // Detail enrichment failed — fields below stay at their
      // discovery-only fallback values, some of which may be null.
    }

    payloads.push({
      exchangeIdentifier: row.symbol, // no ISIN available from this source; symbol is the best stable identifier we have
      tradingSymbol: row.symbol,
      slug: String(row.companyName || row.symbol)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      companyName: row.companyName,
      issueType: series === "SME" ? "sme" : "mainboard",
      exchange: "NSE",
      openDate,
      closeDate,
      priceBandMin: detailFields.priceBandMin ?? discoveryPrice?.min ?? null,
      priceBandMax: detailFields.priceBandMax ?? discoveryPrice?.max ?? null,
      lotSize: detailFields.lotSize ?? (row.lotSize ? Number(row.lotSize) : null),
      faceValue: detailFields.faceValue,
      registrarName: detailFields.registrarName,
      registrarAllotmentUrl: detailFields.registrarAllotmentUrl,
      prospectusUrl: detailFields.prospectusUrl,
      // minInvestment and issueSizeCr are computed by the caller once
      // priceBandMax/lotSize are known, since they're derived, not
      // sourced directly.
      sourceUrl,
    });
  }

  return payloads;
}

/**
 * Once daily (08:00 IST): refresh slow-changing details for an
 * existing issue via the same detail parser used above.
 */
async function fetchIssueDetails(issue) {
  const series = issue.issueType === "sme" ? "SME" : "EQ";
  const raw = await fetchIpoDetailRaw(issue.tradingSymbol, series);
  const fields = parseIssueDetailFields(raw);
  const sourceUrl = `${NSE_ORIGIN}/api/ipo-detail?symbol=${issue.tradingSymbol}&series=${series}`;

  // DU-4: only include fields that actually parsed — omit nulls so
  // the caller's $set never overwrites a good existing value with null.
  const patch = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) patch[key] = value;
  }

  return { patch, sourceUrl };
}

/**
 * GET /api/quote-equity?symbol=X returned "Access Denied" in live
 * testing (22 Sep 2026), even with a valid session cookie. This is
 * very likely an IP-based block, not a header/cookie problem — NSE
 * (like most Indian exchange sites) blocklists most cloud/datacenter
 * egress ranges (AWS, GCP, Azure, Vercel...) outright, independent of
 * what headers or cookies the request carries. A JS-challenge
 * (Akamai-style bot management requiring computed browser fingerprint
 * tokens a plain HTTP client can't produce) is the other likely
 * cause. Diagnose which one you're hitting by running the same
 * request from a normal home internet connection — see the project
 * README's "quote-equity Access Denied" section for the exact curl
 * commands to test with.
 *
 * This function now has THREE tiers instead of one hard failure:
 *
 *   1. Try NSE directly (works if you're not on a blocked IP —
 *      e.g. running the local scheduler from a home connection).
 *   2. If NSE fails AND a fallback provider is configured via
 *      LISTING_PRICE_PROVIDER, try that instead (see
 *      fetchListingFromFallbackProvider below — wire this to
 *      whichever real market-data API you choose; Twelve Data,
 *      Kite Connect, etc. all have NSE coverage).
 *   3. If both fail, throw — the job logs it and the admin can
 *      still set listingPrice/listingGainPercent manually via the
 *      override endpoint (FR-14/DU-9). No automated feed here is
 *      preferable to a fabricated number (§5's core principle).
 */
async function fetchListingResult(issue) {
  try {
    return await fetchListingFromNse(issue);
  } catch (nseErr) {
    if (!process.env.LISTING_PRICE_PROVIDER) {
      throw new Error(
        `NSE quote-equity failed (${nseErr.message}) and no fallback provider is configured ` +
          `(set LISTING_PRICE_PROVIDER in .env — see README).`
      );
    }
    try {
      return await fetchListingFromFallbackProvider(issue);
    } catch (fallbackErr) {
      throw new Error(
        `NSE failed (${nseErr.message}); fallback provider "${process.env.LISTING_PRICE_PROVIDER}" ` +
          `also failed (${fallbackErr.message})`
      );
    }
  }
}

async function fetchListingFromNse(issue) {
  const path = "/api/quote-equity";
  if (!(await isAllowedByRobots(NSE_ORIGIN, path))) {
    throw new Error(`Fetch blocked by robots.txt: ${NSE_ORIGIN}${path}`);
  }

  const cookies = await getNseCookies();
  const sourceUrl = `${NSE_ORIGIN}${path}?symbol=${encodeURIComponent(issue.tradingSymbol)}`;

  const res = await axios.get(sourceUrl, {
    headers: {
      "User-Agent": process.env.FETCH_USER_AGENT,
      Cookie: cookies,
      Referer: `${NSE_ORIGIN}/get-quotes/equity?symbol=${encodeURIComponent(issue.tradingSymbol)}`,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const lastPrice = res.data?.priceInfo?.lastPrice;
  if (lastPrice == null) {
    throw new Error(`No lastPrice in NSE quote response for ${issue.tradingSymbol}`);
  }

  const listingPrice = Number(lastPrice);
  const listingGainPercent = Number(
    (((listingPrice - issue.priceBandMax) / issue.priceBandMax) * 100).toFixed(2)
  );

  return { listingPrice, listingGainPercent, sourceUrl };
}

/**
 * STUB — wire this to a real market-data API before relying on it.
 * `LISTING_PRICE_PROVIDER` picks which branch runs; add a case per
 * vendor you set up. Each branch must return the same shape as
 * fetchListingFromNse: { listingPrice, listingGainPercent, sourceUrl }.
 */
async function fetchListingFromFallbackProvider(issue) {
  const provider = process.env.LISTING_PRICE_PROVIDER;

  if (provider === "twelvedata") {
    if (!process.env.TWELVEDATA_API_KEY) {
      throw new Error("TWELVEDATA_API_KEY not set");
    }
    const sourceUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
      issue.tradingSymbol
    )}:NSE&apikey=${process.env.TWELVEDATA_API_KEY}`;
    const res = await axios.get(sourceUrl);
    const lastPrice = res.data?.close;
    if (lastPrice == null) throw new Error("No close price in Twelve Data response");

    const listingPrice = Number(lastPrice);
    const listingGainPercent = Number(
      (((listingPrice - issue.priceBandMax) / issue.priceBandMax) * 100).toFixed(2)
    );
    // Strip the API key before storing as sourceUrl (DR-2 wants
    // provenance, not a live credential sitting in the database).
    return {
      listingPrice,
      listingGainPercent,
      sourceUrl: `https://api.twelvedata.com/quote?symbol=${issue.tradingSymbol}:NSE`,
    };
  }

  throw new Error(`Unknown LISTING_PRICE_PROVIDER: "${provider}"`);
}

module.exports = { fetchNewAndUpcomingIssues, fetchIssueDetails, fetchListingResult };
