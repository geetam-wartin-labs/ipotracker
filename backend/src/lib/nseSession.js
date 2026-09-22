const axios = require("axios");

/**
 * NSE's API endpoints reject requests without a valid session cookie
 * obtained from their homepage first. This is shared by every fetcher
 * that hits nseindia.com so the cookie isn't re-fetched (and the
 * homepage isn't hit) on every single call.
 *
 * Cookies expire quickly and unpredictably in practice — 4 minutes is
 * a conservative refresh interval, not a documented guarantee.
 */
let cookieJar = null;
let cookieFetchedAt = 0;
const COOKIE_TTL_MS = 4 * 60 * 1000;

async function getNseCookies() {
  if (cookieJar && Date.now() - cookieFetchedAt < COOKIE_TTL_MS) {
    return cookieJar;
  }

  const res = await axios.get("https://www.nseindia.com", {
    headers: { "User-Agent": process.env.FETCH_USER_AGENT },
  });

  const setCookie = res.headers["set-cookie"];
  if (!setCookie || setCookie.length === 0) {
    throw new Error("NSE did not return session cookies — request was likely blocked");
  }

  cookieJar = setCookie.map((c) => c.split(";")[0]).join("; ");
  cookieFetchedAt = Date.now();
  return cookieJar;
}

module.exports = { getNseCookies };
