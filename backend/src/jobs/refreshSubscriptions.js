const Issue = require("../models/Issue");
const Subscription = require("../models/Subscription");
const FetchLog = require("../models/FetchLog");
const { deriveStatus } = require("../lib/status");
const { validateSubscription } = require("../lib/validate");
const { fetchSubscription } = require("../lib/fetchers/subscriptionFetcher");
const { checkConsecutiveFailures } = require("../lib/alerting");
const { throttle } = require("../lib/rateLimiter");

const CATEGORIES = ["qib", "nii", "retail", "employee", "overall"];
const JOB_NAME = "refreshSubscriptions";
const SOURCE = "nseindia-subscription";

/**
 * DR-1 subscription refresh window: every 30 min, 10:00-18:00 IST,
 * open issues only. The window/schedule itself lives in cron/scheduler
 * (local) or vercel.json (prod) — this function just does one pass.
 */
async function refreshSubscriptions() {
  const now = new Date();
  const issues = await Issue.find({}).lean();
  const openIssues = issues.filter((i) => deriveStatus(i, now) === "open");

  const results = [];

  for (const issue of openIssues) {
    for (const category of CATEGORIES) {
      // NFR-6: don't hammer the source — one request at a time, spaced out.
      await throttle(SOURCE);

      const started = Date.now();
      let outcome = "failure";
      let error = null;

      try {
        const latest = await Subscription.findOne({ issue: issue._id, category })
          .sort({ fetchedAt: -1 })
          .lean();
        const previousValue = latest ? latest.timesSubscribed : null;

        const fetched = await fetchSubscription(issue, category, previousValue);
        if (!fetched) {
          outcome = "success"; // source had nothing new; not an error
        } else {
          const { valid, reason } = validateSubscription(
            fetched.timesSubscribed,
            previousValue
          );

          if (!valid) {
            outcome = "rejected";
            error = reason;
            // DU-4: a failed/rejected fetch never overwrites the existing value.
          } else {
            await Subscription.create({
              issue: issue._id,
              category,
              timesSubscribed: fetched.timesSubscribed,
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

      const durationMs = Date.now() - started;
      await FetchLog.create({
        jobName: JOB_NAME,
        source: SOURCE,
        outcome,
        durationMs,
        error,
        issueSlug: issue.slug,
        detail: { category },
        at: now,
      });

      if (outcome !== "success") {
        await checkConsecutiveFailures(JOB_NAME, SOURCE);
      }

      results.push({ slug: issue.slug, category, outcome, error });
    }
  }

  return { checked: openIssues.length, results };
}

module.exports = { refreshSubscriptions };
