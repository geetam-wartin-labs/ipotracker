const express = require("express");
const Issue = require("../models/Issue");
const { deriveStatus, opensWithinDays } = require("../lib/status");
const { serializeIssueSummary, serializeIssueDetail } = require("../lib/serialize");

const router = express.Router();

// GET /api/ipos
// Query params (FR-6 — the FRONTEND encodes these in its own URL;
// this endpoint just needs to accept them):
//   status=upcoming|open|closed|listed
//   type=mainboard|sme
//   openToday=true            (FR-1)
//   upcomingDays=14           (FR-2)
//   page, limit
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const { status, type, openToday, upcomingDays, page = "1", limit = "50" } = req.query;

    const query = {};
    if (type) query.issueType = type;

    let issues = await Issue.find(query).lean();

    if (openToday === "true") {
      issues = issues.filter((i) => deriveStatus(i, now) === "open");
    } else if (status) {
      issues = issues.filter((i) => deriveStatus(i, now) === status);
    } else if (upcomingDays) {
      const days = Number(upcomingDays) || 14;
      issues = issues.filter((i) => opensWithinDays(i, days, now));
    }

    // FR-1: sort by closing date, earliest first.
    issues.sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate));

    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(1, Number(limit)));
    const paged = issues.slice((p - 1) * l, p * l);

    const items = await Promise.all(paged.map((i) => serializeIssueSummary(i, now)));

    res.json({
      items,
      page: p,
      limit: l,
      total: issues.length,
      serverTime: now.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ipos/:slug
router.get("/:slug", async (req, res) => {
  try {
    const now = new Date();
    const issue = await Issue.findOne({ slug: req.params.slug }).lean();
    if (!issue) return res.status(404).json({ error: "IPO not found" });

    const detail = await serializeIssueDetail(issue, now);
    res.json({ ...detail, serverTime: now.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
