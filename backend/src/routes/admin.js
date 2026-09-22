const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Issue = require("../models/Issue");
const { requireAdmin } = require("../middleware/auth");
const { validatePriceBand, validateIssueDates } = require("../lib/validate");

const router = express.Router();

// POST /api/admin/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { sub: admin._id.toString(), username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/ipos — list every field, unfiltered, for the admin table
router.get("/ipos", requireAdmin, async (req, res) => {
  try {
    const issues = await Issue.find({}).sort({ closeDate: 1 }).lean();
    res.json({ items: issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/ipos/:slug
// FR-14 / DU-9: an authenticated admin may correct ANY field manually
// and mark it verified. Every change is appended to issue.overrides
// (audit trail) rather than silently replacing history.
//
// Two kinds of editable fields:
//  - PLAIN_EDITABLE_FIELDS: simple scalars, assigned directly.
//  - PROVISIONAL_DATE_FIELDS: the {date, provisional} subdocuments
//    (allotment/refund/demat/listing) — these were previously NOT
//    editable at all, which was a real gap against FR-14's "any field."
const PLAIN_EDITABLE_FIELDS = [
  "companyName",
  "exchangeIdentifier",
  "tradingSymbol",
  "issueType",
  "exchange",
  "openDate",
  "closeDate",
  "priceBandMin",
  "priceBandMax",
  "lotSize",
  "minInvestment",
  "issueSizeCr",
  "freshIssueCr",
  "offerForSaleCr",
  "faceValue",
  "registrarName",
  "registrarAllotmentUrl",
  "prospectusUrl",
  "listingPrice",
  "listingGainPercent",
];

const PROVISIONAL_DATE_FIELDS = [
  "allotmentDate",
  "refundDate",
  "dematCreditDate",
  "listingDate",
];

const ALL_EDITABLE_FIELDS = [...PLAIN_EDITABLE_FIELDS, ...PROVISIONAL_DATE_FIELDS];

/** Validates a {date, provisional} payload before it's applied. */
function validateProvisionalDatePatch(value) {
  if (value === null) return { valid: true, normalized: { date: null, provisional: true } };
  if (typeof value !== "object") {
    return { valid: false, reason: "Provisional date field must be an object { date, provisional }" };
  }
  const { date, provisional } = value;
  if (date != null) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, reason: `Invalid date value: ${date}` };
    }
    return { valid: true, normalized: { date: parsed, provisional: provisional !== false } };
  }
  return { valid: true, normalized: { date: null, provisional: true } };
}

router.patch("/ipos/:slug", requireAdmin, async (req, res) => {
  try {
    const issue = await Issue.findOne({ slug: req.params.slug });
    if (!issue) return res.status(404).json({ error: "IPO not found" });

    const { fields = {}, markVerified, reason } = req.body;
    const keys = Object.keys(fields).filter((k) => ALL_EDITABLE_FIELDS.includes(k));

    if (keys.length === 0 && markVerified === undefined) {
      return res.status(422).json({ error: "No editable fields supplied" });
    }

    // Validate combined result before applying anything (DU-5/DU-6
    // apply to admin overrides too — an admin can still fat-finger a value).
    const nextMin = fields.priceBandMin ?? issue.priceBandMin;
    const nextMax = fields.priceBandMax ?? issue.priceBandMax;
    const bandCheck = validatePriceBand(nextMin, nextMax);
    if (!bandCheck.valid) return res.status(422).json({ error: bandCheck.reason });

    const nextOpen = fields.openDate ?? issue.openDate;
    const nextClose = fields.closeDate ?? issue.closeDate;
    const dateCheck = validateIssueDates(nextOpen, nextClose);
    if (!dateCheck.valid) return res.status(422).json({ error: dateCheck.reason });

    // Pre-validate every provisional-date field in the payload before
    // applying any of them, so a bad one doesn't leave a half-applied update.
    const normalizedDateFields = {};
    for (const key of keys) {
      if (PROVISIONAL_DATE_FIELDS.includes(key)) {
        const check = validateProvisionalDatePatch(fields[key]);
        if (!check.valid) {
          return res.status(422).json({ error: `${key}: ${check.reason}` });
        }
        normalizedDateFields[key] = check.normalized;
      }
    }

    const overrides = [];
    for (const key of keys) {
      const newValue = PROVISIONAL_DATE_FIELDS.includes(key)
        ? normalizedDateFields[key]
        : fields[key];

      overrides.push({
        field: key,
        previousValue: issue[key],
        newValue,
        byAdmin: req.admin.username,
        at: new Date(),
        reason: reason || null,
      });
      issue[key] = newValue;
    }

    if (markVerified !== undefined) {
      issue.verified = !!markVerified;
    }

    issue.overrides.push(...overrides);
    issue.fetchedAt = new Date();
    issue.sourceUrl = `manual-override:${req.admin.username}`;

    await issue.save();
    res.json({ ok: true, issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
