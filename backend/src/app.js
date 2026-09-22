require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const iposRoutes = require("./routes/ipos");
const adminRoutes = require("./routes/admin");
const cronRoutes = require("./routes/cron");

const app = express();

app.use(
  cors({
    origin:"*",
  })
);
app.use(express.json());

// Ensure a DB connection exists before handling any request. Cheap
// no-op on warm serverless invocations (connectDB caches the conn).
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: "Database unavailable", detail: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/ipos", iposRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cron", cronRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
