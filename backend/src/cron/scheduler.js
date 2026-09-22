/**
 * LOCAL / non-Vercel deployment only. If you're hosting this on
 * Vercel, DON'T run this — use vercel.json's `crons` config instead
 * (NFR-5: no persistent server process on that platform). This file
 * exists so the same jobs can be exercised with `npm run scheduler`
 * on a normal VM/container, or for local testing.
 */
require("dotenv").config();
const cron = require("node-cron");
const connectDB = require("../config/db");
const { refreshSubscriptions } = require("../jobs/refreshSubscriptions");
const { refreshGreyMarket } = require("../jobs/refreshGreyMarket");
const {
  refreshNewAndUpcomingIssues,
  refreshIssueDetailsForAll,
} = require("../jobs/refreshIssues");
const { refreshListingForToday } = require("../jobs/refreshListing");

const TZ = "Asia/Kolkata";

async function run(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`[cron] ${name} ok in ${Date.now() - start}ms`, result);
  } catch (err) {
    console.error(`[cron] ${name} failed`, err);
  }
}

async function main() {
  await connectDB();
  console.log("Scheduler connected to DB, registering jobs (Asia/Kolkata)...");

  // DR-5 table, §5. Two rules so the window is exactly 10:00-18:00
  // IST inclusive, not 10:00-18:30 (a plain "*/30 10-18" would also
  // fire at 18:30, one tick past the window).
  cron.schedule("*/30 10-17 * * *", () => run("subscriptions", refreshSubscriptions), {
    timezone: TZ,
  });
  cron.schedule("0 18 * * *", () => run("subscriptions", refreshSubscriptions), {
    timezone: TZ,
  });
  cron.schedule("0 */2 * * *", () => run("grey-market", refreshGreyMarket), { timezone: TZ });
  cron.schedule("0 8,20 * * *", () => run("new-issues", refreshNewAndUpcomingIssues), {
    timezone: TZ,
  });
  cron.schedule("0 8 * * *", () => run("issue-details", refreshIssueDetailsForAll), {
    timezone: TZ,
  });
  cron.schedule("0 18 * * *", () => run("listing", refreshListingForToday), { timezone: TZ });

  console.log("Scheduler running. Ctrl+C to stop.");
}

main();
