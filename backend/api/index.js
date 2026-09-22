// Vercel serverless entry point. Any request to /api/* on this
// project is routed here (see ../vercel.json) and handled by the
// same Express app used for local dev — via serverless-http, which
// adapts the (req, res) Express handler to Vercel's Node function
// signature. No persistent process is kept running between requests.
const serverless = require("serverless-http");
const app = require("../src/app");

module.exports = serverless(app);
