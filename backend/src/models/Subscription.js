const mongoose = require("mongoose");

// Append-only (DR-1): every fetch inserts a new document. Never update
// an existing one. "Latest" is derived by querying the most recent
// fetchedAt per (issue, category).
const SubscriptionSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    category: {
      type: String,
      enum: ["qib", "nii", "retail", "employee", "overall"],
      required: true,
    },
    timesSubscribed: { type: Number, required: true },
    fetchedAt: { type: Date, required: true, index: true },
    sourceUrl: { type: String, required: true },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ issue: 1, category: 1, fetchedAt: -1 });

module.exports =
  mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);
