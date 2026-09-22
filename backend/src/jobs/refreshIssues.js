const Issue = require("../models/Issue");
const FetchLog = require("../models/FetchLog");
const { validatePriceBand, validateIssueDates } = require("../lib/validate");
const {
  fetchNewAndUpcomingIssues,
  fetchIssueDetails,
} = require("../lib/fetchers/issueFetcher");
const { checkConsecutiveFailures } = require("../lib/alerting");
const { throttle } = require("../lib/rateLimiter");

const JOB_NAME_NEW = "refreshNewIssues";
const JOB_NAME_DETAILS = "refreshIssueDetails";
const SOURCE_NEW = "nse-issue-discovery";
const SOURCE_DETAILS = "nse-issue-details";

/** Twice-daily (08:00 / 20:00 IST): discover new/upcoming issues. */
async function refreshNewAndUpcomingIssues() {
  await throttle(SOURCE_NEW);

  const now = new Date();
  const started = Date.now();
  let outcome = "success";
  let error = null;
  let created = 0;

  try {
    const raw = await fetchNewAndUpcomingIssues();
    for (const payload of raw) {
      const exists = await Issue.findOne({
        exchangeIdentifier: payload.exchangeIdentifier,
      });
      if (exists) continue;

      // Required-field completeness check FIRST — the real NSE
      // response doesn't always give us everything (registrar
      // lookup can miss, price-range text can fail to parse). A
      // required field missing here means "skip and log," never
      // "insert with a guessed value."
      const requiredFields = [
        "openDate",
        "closeDate",
        "priceBandMin",
        "priceBandMax",
        "lotSize",
        "faceValue",
        "registrarName",
        "registrarAllotmentUrl",
      ];
      const missing = requiredFields.filter((f) => payload[f] == null);
      if (missing.length > 0) {
        await FetchLog.create({
          jobName: JOB_NAME_NEW,
          source: payload.sourceUrl || SOURCE_NEW,
          outcome: "rejected",
          durationMs: Date.now() - started,
          error: `Missing required field(s) after enrichment: ${missing.join(", ")}`,
          detail: { exchangeIdentifier: payload.exchangeIdentifier },
          at: now,
        });
        continue;
      }

      const dateCheck = validateIssueDates(payload.openDate, payload.closeDate);
      const bandCheck = validatePriceBand(payload.priceBandMin, payload.priceBandMax);
      if (!dateCheck.valid || !bandCheck.valid) {
        await FetchLog.create({
          jobName: JOB_NAME_NEW,
          source: payload.sourceUrl || SOURCE_NEW,
          outcome: "rejected",
          durationMs: Date.now() - started,
          error: !dateCheck.valid ? dateCheck.reason : bandCheck.reason,
          detail: { exchangeIdentifier: payload.exchangeIdentifier },
          at: now,
        });
        continue;
      }

      // minInvestment and issueSizeCr are DERIVED, not sourced
      // directly (see issueFetcher.js's comment) — computed here,
      // now that we know priceBandMax and lotSize are both present.
      const minInvestment = payload.lotSize * payload.priceBandMax;

      await Issue.create({
        ...payload,
        minInvestment,
        issueSizeCr: null, // NSE's free-text "Issue Size" field mixes
        // money and share-count in a format that varies per IPO and
        // isn't reliably parseable — left null rather than guessed;
        // an admin can fill this in via the override endpoint (FR-14).
        fetchedAt: now,
      });
      created += 1;
    }
  } catch (err) {
    outcome = "failure";
    error = err.message;
  }

  await FetchLog.create({
    jobName: JOB_NAME_NEW,
    source: SOURCE_NEW,
    outcome,
    durationMs: Date.now() - started,
    error,
    detail: { created },
    at: now,
  });

  // DU-8, previously missing from this job entirely.
  if (outcome !== "success") {
    await checkConsecutiveFailures(JOB_NAME_NEW, SOURCE_NEW);
  }

  return { created, outcome, error };
}

/**
 * Once daily (08:00 IST): refresh slow-changing details for existing
 * issues. DU-4: a failed fetch never overwrites an existing value —
 * we only apply fields that are present in the fetched patch.
 */
async function refreshIssueDetailsForAll() {
  const now = new Date();
  const issues = await Issue.find({}).lean();
  const results = [];

  for (const issue of issues) {
    await throttle(SOURCE_DETAILS);

    const started = Date.now();
    let outcome = "failure";
    let error = null;

    try {
      const { patch, sourceUrl } = await fetchIssueDetails(issue);

      if (patch.priceBandMin != null || patch.priceBandMax != null) {
        const min = patch.priceBandMin ?? issue.priceBandMin;
        const max = patch.priceBandMax ?? issue.priceBandMax;
        const check = validatePriceBand(min, max);
        if (!check.valid) {
          outcome = "rejected";
          error = check.reason;
        }
      }

      if (outcome !== "rejected") {
        if (Object.keys(patch).length > 0) {
          await Issue.updateOne(
            { _id: issue._id },
            { $set: { ...patch, fetchedAt: now, sourceUrl } }
          );
        }
        outcome = "success";
      }
    } catch (err) {
      outcome = "failure";
      error = err.message;
    }

    await FetchLog.create({
      jobName: JOB_NAME_DETAILS,
      source: SOURCE_DETAILS,
      outcome,
      durationMs: Date.now() - started,
      error,
      issueSlug: issue.slug,
      at: now,
    });

    // DU-8, previously missing from this job entirely.
    if (outcome !== "success") {
      await checkConsecutiveFailures(JOB_NAME_DETAILS, SOURCE_DETAILS);
    }

    results.push({ slug: issue.slug, outcome, error });
  }

  return { checked: issues.length, results };
}

module.exports = { refreshNewAndUpcomingIssues, refreshIssueDetailsForAll };
