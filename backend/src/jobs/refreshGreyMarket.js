const Issue = require("../models/Issue");
const GreyMarket = require("../models/GreyMarket");
const FetchLog = require("../models/FetchLog");
const { deriveStatus } = require("../lib/status");
const { validateGreyMarketPremium } = require("../lib/validate");
const { fetchGreyMarketPremium } = require("../lib/fetchers/greyMarketFetcher");
const { checkConsecutiveFailures } = require("../lib/alerting");
const { throttle } = require("../lib/rateLimiter");

const JOB_NAME = "refreshGreyMarket";
const SOURCE = "investorgain-gmp";

/** GMP is tracked pre-listing (upcoming/open/closed), daily, every 2h. */
async function refreshGreyMarket() {
  const now = new Date();
  const issues = await Issue.find({}).lean();
  const relevant = issues.filter((i) => deriveStatus(i, now) !== "listed");

  const results = [];

  for (const issue of relevant) {
    await throttle(SOURCE);

    const started = Date.now();
    let outcome = "failure";
    let error = null;

    try {
      const latest = await GreyMarket.findOne({ issue: issue._id })
        .sort({ fetchedAt: -1 })
        .lean();
      const previousValue = latest ? latest.premiumAmount : null;

      const fetched = await fetchGreyMarketPremium(issue, previousValue);

      if (!fetched) {
        outcome = "success"; // no audited name-mapping entry, or nothing new — not an error
      } else {
        const { valid, reason } = validateGreyMarketPremium(
          fetched.premiumAmount,
          previousValue
        );

        if (!valid) {
          outcome = "rejected";
          error = reason;
        } else {
          await GreyMarket.create({
            issue: issue._id,
            premiumAmount: fetched.premiumAmount,
            impliedGainPercent: fetched.impliedGainPercent,
            fetchedAt: now,
            sourceUrl: fetched.sourceUrl,
          });
          outcome = "success";
        }
      }
    } catch (err) {
      outcome = "failure";
      error = err.message;
    }

    await FetchLog.create({
      jobName: JOB_NAME,
      source: SOURCE,
      outcome,
      durationMs: Date.now() - started,
      error,
      issueSlug: issue.slug,
      at: now,
    });

    // DU-8, previously missing from this job entirely.
    if (outcome !== "success") {
      await checkConsecutiveFailures(JOB_NAME, SOURCE);
    }

    results.push({ slug: issue.slug, outcome, error });
  }

  return { checked: relevant.length, results };
}

module.exports = { refreshGreyMarket };
