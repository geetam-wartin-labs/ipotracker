const FetchLog = require("../models/FetchLog");

/**
 * DU-8: three consecutive failures against one source raises an
 * alert. Shared by every job — previously this only lived inside
 * refreshSubscriptions.js, so grey market, issue details and listing
 * refreshes could fail silently forever with no alert ever firing.
 *
 * "Alert" here means a loud, structured log line. There is no paging
 * notification channel specified in the requirements, so this is
 * the honest implementation of what's asked for — wiring it to
 * Slack/PagerDuty/email is a follow-up, not a spec gap.
 */
async function checkConsecutiveFailures(jobName, source) {
  const recent = await FetchLog.find({ jobName, source }).sort({ at: -1 }).limit(3).lean();

  const allFailed = recent.length === 3 && recent.every((r) => r.outcome !== "success");

  if (allFailed) {
    // eslint-disable-next-line no-console
    console.error(
      `[ALERT] 3 consecutive failures — job="${jobName}" source="${source}". ` +
        `Last error: ${recent[0].error || "(no error message recorded)"}`
    );
  }

  return allFailed;
}

module.exports = { checkConsecutiveFailures };
