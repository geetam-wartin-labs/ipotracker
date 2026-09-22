const express = require("express");
const { requireCronSecret } = require("../middleware/cronAuth");
const { refreshSubscriptions } = require("../jobs/refreshSubscriptions");
const { refreshGreyMarket } = require("../jobs/refreshGreyMarket");
const {
  refreshNewAndUpcomingIssues,
  refreshIssueDetailsForAll,
} = require("../jobs/refreshIssues");
const { refreshListingForToday } = require("../jobs/refreshListing");

const router = express.Router();
router.use(requireCronSecret);

// Each of these is one Vercel Cron target (see /vercel.json). DU-1 /
// NFR-5: the schedule lives in the platform's cron config, not in a
// persistent in-process scheduler.

router.post("/subscriptions", async (req, res) => {
  try {
    const result = await refreshSubscriptions();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/grey-market", async (req, res) => {
  try {
    const result = await refreshGreyMarket();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/new-issues", async (req, res) => {
  try {
    const result = await refreshNewAndUpcomingIssues();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/issue-details", async (req, res) => {
  try {
    const result = await refreshIssueDetailsForAll();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/listing", async (req, res) => {
  try {
    const result = await refreshListingForToday();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
