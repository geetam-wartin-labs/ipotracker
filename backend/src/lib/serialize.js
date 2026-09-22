const Subscription = require("../models/Subscription");
const GreyMarket = require("../models/GreyMarket");
const { deriveStatus, closesToday } = require("./status");
const { freshnessState } = require("./freshness");

const CATEGORIES = ["qib", "nii", "retail", "employee", "overall"];

/** FR-12: wraps a raw value with its own fetch time + freshness state. */
function withFreshness(dataType, value, fetchedAt, now) {
  return {
    value,
    fetchedAt: fetchedAt || null,
    freshness: freshnessState(dataType, fetchedAt, now),
  };
}

/** Issue-detail freshness (FR-12) for the slow-changing fields. */
function issueDetailFreshness(issue, now) {
  return withFreshness("issueDetails", null, issue.fetchedAt, now).freshness;
}

/**
 * Summary shape used in list views (homepage, filtered list). One
 * extra query per issue for "overall" subscription + GMP — fine at
 * MVP scale; would become an aggregation pipeline if issue count grows.
 */
async function serializeIssueSummary(issue, now = new Date()) {
  const [overallSub, gmp] = await Promise.all([
    Subscription.findOne({ issue: issue._id, category: "overall" })
      .sort({ fetchedAt: -1 })
      .lean(),
    GreyMarket.findOne({ issue: issue._id }).sort({ fetchedAt: -1 }).lean(),
  ]);

  return {
    slug: issue.slug,
    companyName: issue.companyName,
    issueType: issue.issueType,
    exchange: issue.exchange,
    status: deriveStatus(issue, now),
    closesToday: closesToday(issue, now),
    openDate: issue.openDate,
    closeDate: issue.closeDate,
    priceBandMin: issue.priceBandMin,
    priceBandMax: issue.priceBandMax,
    lotSize: issue.lotSize,
    overallSubscription: withFreshness(
      "subscription",
      overallSub?.timesSubscribed ?? null,
      overallSub?.fetchedAt ?? null,
      now
    ),
    greyMarketPremium: withFreshness(
      "greyMarket",
      gmp?.premiumAmount ?? null,
      gmp?.fetchedAt ?? null,
      now
    ),
    issueDetailsFreshness: issueDetailFreshness(issue, now),
    issueDetailsFetchedAt: issue.fetchedAt,
    verified: issue.verified,
  };
}

/** Full shape for the detail page — every category broken out (FR-8). */
async function serializeIssueDetail(issue, now = new Date()) {
  const subsByCategory = {};
  for (const category of CATEGORIES) {
    const latest = await Subscription.findOne({ issue: issue._id, category })
      .sort({ fetchedAt: -1 })
      .lean();
    subsByCategory[category] = withFreshness(
      "subscription",
      latest?.timesSubscribed ?? null,
      latest?.fetchedAt ?? null,
      now
    );
  }

  const gmp = await GreyMarket.findOne({ issue: issue._id }).sort({ fetchedAt: -1 }).lean();

  return {
    slug: issue.slug,
    companyName: issue.companyName,
    exchangeIdentifier: issue.exchangeIdentifier,
    tradingSymbol: issue.tradingSymbol,
    issueType: issue.issueType,
    exchange: issue.exchange,
    status: deriveStatus(issue, now),
    closesToday: closesToday(issue, now),

    timetable: {
      openDate: issue.openDate,
      closeDate: issue.closeDate,
      allotmentDate: issue.allotmentDate,
      refundDate: issue.refundDate,
      dematCreditDate: issue.dematCreditDate,
      listingDate: issue.listingDate,
    },

    issueDetails: {
      priceBandMin: issue.priceBandMin,
      priceBandMax: issue.priceBandMax,
      lotSize: issue.lotSize,
      minInvestment: issue.minInvestment,
      issueSizeCr: issue.issueSizeCr,
      freshIssueCr: issue.freshIssueCr,
      offerForSaleCr: issue.offerForSaleCr,
      faceValue: issue.faceValue,
      registrarName: issue.registrarName,
      registrarAllotmentUrl: issue.registrarAllotmentUrl,
      prospectusUrl: issue.prospectusUrl,
      fetchedAt: issue.fetchedAt,
      freshness: issueDetailFreshness(issue, now),
      verified: issue.verified,
    },

    listing: {
      listingPrice: issue.listingPrice,
      listingGainPercent: issue.listingGainPercent,
    },

    subscription: subsByCategory,

    greyMarketPremium: {
      ...withFreshness(
        "greyMarket",
        gmp?.premiumAmount ?? null,
        gmp?.fetchedAt ?? null,
        now
      ),
      impliedGainPercent: gmp?.impliedGainPercent ?? null,
      // FR-13: this notice must always travel with the figure.
      notice:
        "Unofficial figure. Not sourced from any exchange. For indication only.",
    },
  };
}

module.exports = { serializeIssueSummary, serializeIssueDetail, CATEGORIES };
