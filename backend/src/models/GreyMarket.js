const mongoose = require("mongoose");

// Append-only (DR-1), same pattern as Subscription.
const GreyMarketSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    premiumAmount: { type: Number, required: true }, // in ₹ per share
    impliedGainPercent: { type: Number, required: true },
    fetchedAt: { type: Date, required: true, index: true },
    sourceUrl: { type: String, required: true },
  },
  { timestamps: true }
);

GreyMarketSchema.index({ issue: 1, fetchedAt: -1 });

module.exports =
  mongoose.models.GreyMarket || mongoose.model("GreyMarket", GreyMarketSchema);
