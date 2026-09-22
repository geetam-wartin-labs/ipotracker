const mongoose = require("mongoose");

// NFR-7: the administrative interface requires authentication.
const AdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
