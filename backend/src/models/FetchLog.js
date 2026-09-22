const mongoose = require("mongoose");

// DU-7: every fetch attempt is logged with source, outcome, duration
// and error, so any displayed value can be traced back to the fetch
// that produced it.
const FetchLogSchema = new mongoose.Schema(
  {
    jobName: { type: String, required: true, index: true },
    source: { type: String, required: true },
    outcome: { type: String, enum: ["success", "failure", "rejected"], required: true },
    durationMs: { type: Number, required: true },
    error: { type: String, default: null },
    issueSlug: { type: String, default: null, index: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

module.exports = mongoose.models.FetchLog || mongoose.model("FetchLog", FetchLogSchema);
