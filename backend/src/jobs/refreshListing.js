const Issue = require("../models/Issue");
const FetchLog = require("../models/FetchLog");
const { fetchListingResult } = require("../lib/fetchers/issueFetcher");
const { checkConsecutiveFailures } = require("../lib/alerting");
const { throttle } = require("../lib/rateLimiter");

const JOB_NAME = "refreshListing";
const SOURCE = "nse-listing-result";

/** Once daily, 18:00 IST — only for issues listing that calendar day. */
async function refreshListingForToday() {
  const now = new Date();
  const issues = await Issue.find({}).lean();

  const listingToday = issues.filter((issue) => {
    if (!issue.listingDate?.date) return false;
    const listing = new Date(issue.listingDate.date);
    return (
      listing.getUTCFullYear() === now.getUTCFullYear() &&
      listing.getUTCMonth() === now.getUTCMonth() &&
      listing.getUTCDate() === now.getUTCDate()
    );
  });

  const results = [];

  for (const issue of listingToday) {
    await throttle(SOURCE);

    const started = Date.now();
    let outcome = "failure";
    let error = null;

    try {
      const { listingPrice, listingGainPercent, sourceUrl } = await fetchListingResult(
        issue
      );
      await Issue.updateOne(
        { _id: issue._id },
        { $set: { listingPrice, listingGainPercent, fetchedAt: now, sourceUrl } }
      );
      outcome = "success";
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

  return { checked: listingToday.length, results };
}

module.exports = { refreshListingForToday };
