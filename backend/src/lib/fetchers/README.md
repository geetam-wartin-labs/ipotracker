# Fetchers

These files are the ONLY place that talks to an external data source.
Everything downstream (validation, append-only storage, fetch
logging, freshness display) is source-agnostic and unchanged by
anything in this folder.

## Status: live, but unverified

All three fetchers now make real HTTP calls (NSE for subscriptions,
issue details and listing results; investorgain.com for GMP) instead
of returning mock data. **None of the field names or HTML selectors
in this code have been confirmed against a live response** — they're
structurally correct patterns based on how these sources are known to
be shaped, not something tested against the actual sites from this
environment.

Before relying on this in production:

1. Hit each endpoint manually (`curl` with the right headers, or a
   throwaway script) for one real, currently-open IPO.
2. Compare the raw response against the field names each fetcher
   expects (`biddingSummary`, `issueStartDate`, `marketLot`, etc. for
   NSE; the `cells[2]` column index for the GMP table).
3. Fix whatever doesn't match — these sources change their shape
   without notice, so this needs occasional re-verification even once
   it's working.

## Other things NOT yet handled here

- **Rate limiting (NFR-6).** Nothing in this folder throttles
  requests. Add a per-source delay/queue before running this on a
  schedule, or expect to get IP-blocked quickly.
- **robots.txt compliance (NFR-6).** Not checked automatically —
  confirm manually that the paths hit here are allowed.
- **DR-3 (match by identifier, never by name).** Handled properly for
  NSE (its API returns ISIN/symbol directly). For the GMP source,
  which only publishes company name, this is handled via
  `../../data/gmpNameMapping.json` — a manually-maintained,
  hand-audited symbol→name-as-it-appears mapping. An issue with no
  entry there is skipped (returns `null`), never fuzzy-matched.
- **NSE bot detection.** The cookie-based session in `../nseSession.js`
  works intermittently at best. A paid market-data vendor is the
  more reliable path for production use.
