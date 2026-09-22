const axios = require("axios");

/**
 * NFR-6: "respect... robots directives." A minimal robots.txt parser
 * good enough for the two hosts this project talks to (nseindia.com,
 * investorgain.com) — checks whether a given path is disallowed for
 * our user-agent (falling back to `*`), nothing more elaborate
 * (no crawl-delay parsing, no wildcard path matching beyond a
 * simple prefix check, which covers the vast majority of real
 * robots.txt files).
 *
 * Cached per-host for the process lifetime so this doesn't add a
 * request to robots.txt on every single fetch.
 */
const robotsCache = {};

async function getRobotsRules(origin) {
  if (robotsCache[origin]) return robotsCache[origin];

  try {
    const res = await axios.get(`${origin}/robots.txt`, {
      headers: { "User-Agent": process.env.FETCH_USER_AGENT },
      timeout: 5000,
    });
    const rules = parseRobotsTxt(res.data);
    robotsCache[origin] = rules;
    return rules;
  } catch (err) {
    // If robots.txt is unreachable, default to "no disallows recorded"
    // rather than blocking every fetch — but log it, since silently
    // ignoring robots.txt errors forever would defeat the point.
    // eslint-disable-next-line no-console
    console.warn(`[robots] Could not fetch ${origin}/robots.txt: ${err.message}`);
    robotsCache[origin] = { disallow: [] };
    return robotsCache[origin];
  }
}

function parseRobotsTxt(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const disallow = [];
  let inRelevantGroup = false;

  for (const line of lines) {
    if (/^user-agent:\s*\*/i.test(line)) {
      inRelevantGroup = true;
      continue;
    }
    if (/^user-agent:/i.test(line)) {
      inRelevantGroup = false;
      continue;
    }
    if (inRelevantGroup && /^disallow:/i.test(line)) {
      const path = line.split(":").slice(1).join(":").trim();
      if (path) disallow.push(path);
    }
  }

  return { disallow };
}

/**
 * Returns true if `path` (e.g. "/api/ipo-detail") is allowed by the
 * target origin's robots.txt for `*`.
 */
async function isAllowedByRobots(origin, path) {
  const { disallow } = await getRobotsRules(origin);
  return !disallow.some((rule) => path.startsWith(rule));
}

module.exports = { isAllowedByRobots };
