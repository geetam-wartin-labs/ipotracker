const mongoose = require("mongoose");

// A "provisional date" sub-document: value + whether it's confirmed yet.
// DR-4: provisional dates must be stored as provisional and displayed
// as such until confirmed.
const ProvisionalDateSchema = new mongoose.Schema(
  {
    date: { type: Date, default: null },
    provisional: { type: Boolean, default: true },
  },
  { _id: false }
);

// FR-14 / DU-9: lightweight audit trail for admin manual overrides.
const OverrideSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    byAdmin: { type: String, required: true },
    at: { type: Date, default: Date.now },
    reason: String,
  },
  { _id: false }
);

const IssueSchema = new mongoose.Schema(
  {
    // Identity — DR-3: IPOs are matched across sources by exchange
    // identifier / trading symbol, NEVER by company name.
    exchangeIdentifier: { type: String, required: true, unique: true, index: true },
    tradingSymbol: { type: String, index: true },

    slug: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true },

    issueType: { type: String, enum: ["mainboard", "sme"], required: true },
    exchange: { type: String, enum: ["BSE", "NSE", "BOTH"], required: true },

    // Drive status derivation (FR-10) — see lib/status.js. Never store
    // a "status" field directly; it is always computed from these dates.
    openDate: { type: Date, required: true },
    closeDate: { type: Date, required: true },

    allotmentDate: { type: ProvisionalDateSchema, default: () => ({}) },
    refundDate: { type: ProvisionalDateSchema, default: () => ({}) },
    dematCreditDate: { type: ProvisionalDateSchema, default: () => ({}) },
    listingDate: { type: ProvisionalDateSchema, default: () => ({}) },

    priceBandMin: { type: Number, required: true },
    priceBandMax: { type: Number, required: true },
    lotSize: { type: Number, required: true },
    minInvestment: { type: Number, required: true },

    issueSizeCr: { type: Number, default: null }, // ₹ crore — nullable:
    // NSE's discovery/detail endpoints don't reliably expose this as a
    // clean number (see issueFetcher.js); left null when unparseable
    // rather than guessed, fillable via admin override (FR-14).
    freshIssueCr: { type: Number, default: null },
    offerForSaleCr: { type: Number, default: null },
    faceValue: { type: Number, required: true },

    registrarName: { type: String, required: true },
    registrarAllotmentUrl: { type: String, required: true },
    prospectusUrl: { type: String, default: null },

    // Post-listing figures (updated by the "listing price and gain" job)
    listingPrice: { type: Number, default: null },
    listingGainPercent: { type: Number, default: null },

    // Provenance — required on every record (§4)
    sourceUrl: { type: String, required: true },
    fetchedAt: { type: Date, required: true },

    verified: { type: Boolean, default: false },
    overrides: { type: [OverrideSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Issue || mongoose.model("Issue", IssueSchema);
