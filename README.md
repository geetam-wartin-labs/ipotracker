# IPO Tracker

Implementation of `IPO Tracker MVP — Requirements (chittorgarh.com-style)`.
Two deployable halves:

- **`backend/`** — Node/Express + MongoDB. Public read API, admin
  auth + override API, and the scheduled refresh jobs.
- **`frontend/`** — Next.js (App Router). Server-rendered public
  pages, plus a small client-side admin area.

Deploy both as **separate Vercel projects**. That's the natural split
for "Express API + scheduled jobs" vs "Next.js site" on Vercel, and
it's what `backend/vercel.json` and the frontend's zero-config Next.js
detection assume.

## What's real vs. what's a placeholder

Everything except the data sources themselves is real, working logic:
status derivation, freshness thresholds, append-only storage,
validation/rejection, fetch logging, the admin override + audit
trail, and every page/route described in the spec.

**The three files in `backend/src/lib/fetchers/` return mock data**,
not real chittorgarh.com/NSE/BSE figures — see that folder's own
`README.md`. Actually scraping those sources (rate limits, markup
changes, likely needing a paid feed for reliable subscription data)
is separate work. Swap those three functions for real implementations
and nothing else in the codebase needs to change — every job,
route, and page already consumes them through the same interface.

## Local development

### Backend

```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI at minimum
npm install
npm run seed                 # fixtures across all 4 statuses + 1 admin user
npm run dev                  # http://localhost:4000

# in a second terminal, to actually exercise the refresh jobs locally:
npm run scheduler
```

`npm run seed` prints the admin username; the password is whatever
you set as `ADMIN_SEED_PASSWORD` in `.env` (defaults to `change-me`
if unset — don't ship that default).

### Frontend

```bash
cd frontend
cp .env.example .env         # NEXT_PUBLIC_API_BASE=http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Visit `/` for the homepage, `/ipos?status=open&type=sme` for the
filtered list (try it with JS disabled — it still works, per NFR-3),
`/ipos/<slug>` for a detail page, and `/admin/login` for the admin
area.

## Deploying to Vercel

**Backend project** (root directory = `backend/`):
1. Set env vars from `.env.example` in the Vercel project settings —
   `MONGODB_URI`, `JWT_SECRET`, `CRON_SECRET`, `FRONTEND_ORIGIN`
   (your deployed frontend's URL).
2. **Before deploying**, edit `backend/vercel.json` and replace every
   `CRON_SECRET_PLACEHOLDER` in the `crons` array with the *literal*
   value you set for `CRON_SECRET`. Vercel's cron config is static
   JSON — it can't read your env vars at cron-fire time, so the token
   has to be baked into the path. (See the comment in
   `src/middleware/cronAuth.js` for the reasoning.)
3. Deploy. Vercel will pick up the `crons` array automatically and
   start firing the scheduled jobs on the timetable from §5 of the
   spec, converted to UTC (Vercel Cron schedules are always UTC).
   Subscriptions get two cron entries (`30 4 * * *` +
   `*/30 5-12 * * *`) rather than one, because a single `*/30 4-12`
   rule would fire 30 minutes before the window opens — the two-entry
   version lands exactly on 10:00, 10:30, ..., 18:00 IST with no
   over/undershoot. If you change any of these times, re-derive the
   UTC equivalent carefully; it's easy to be off by 30 minutes given
   IST's half-hour offset.
4. Run `npm run seed` **once**, against the production `MONGODB_URI`,
   from your machine (or a one-off script) to get initial fixtures in.

**Frontend project** (root directory = `frontend/`):
1. Set `NEXT_PUBLIC_API_BASE` to the backend project's deployed URL.
2. Deploy — it's a stock Next.js app, zero extra config needed.

## Mapping to the spec's acceptance criteria

| Criterion | Where |
|---|---|
| Reachable at a public URL | Both are ordinary Vercel deployments |
| Open-today IPOs on homepage, sorted by close date | `GET /api/ipos?openToday=true`, sorted server-side; rendered by `app/page.js` |
| Subscription accurate within one refresh interval | `jobs/refreshSubscriptions.js` on the DR-5 schedule |
| Status correct, derived from dates | `lib/status.js` — never a stored field (FR-10) |
| Every page/figure shows fetch time | `FreshnessBadge` component, driven by `lib/serialize.js`'s per-figure `{value, fetchedAt, freshness}` shape (FR-11/FR-12) |
| Scheduled job runs unattended | Vercel Cron → `/api/cron/*` (or `npm run scheduler` off-Vercel) |
| Disabling a source → staleness notice, not a stale number as current | `lib/freshness.js` thresholds + `FreshnessBadge`'s "stale" state (DU-3) |
| Invalid value rejected, logged, previous value survives | `lib/validate.js` + every job's reject-and-log path (DU-4/DU-5/DU-6/DU-7) |
| Readable on a phone | Plain responsive CSS, no client-JS dependency for data pages |
| GMP notice + footer disclaimer | `IpoDetailPage`'s GMP notice (FR-13); `components/Footer.js` on every page (NFR-8) |

## Honest gaps against the full spec

- **Fetchers are mocked** (see above) — this is the one deliberate,
  clearly-flagged simplification, because real scraping wasn't
  something to fabricate convincingly in one pass.
- **DU-8 alerting** logs loudly (`console.error`) on 3 consecutive
  failures rather than paging anyone — no alerting channel was
  specified.
- **FR-3's list-row GMP/subscription** are shown as the "overall"
  figures only, not every category inline (the detail page has the
  full per-category breakdown per FR-8).
- Rate limiting / robots-directive compliance (NFR-6) is structural
  (fetchers are the only egress point, easy to gate) but not wired to
  an actual robots.txt parser, since the fetchers are mocks.

## Fixes applied after the initial audit

Every gap flagged in the original honest-audit pass has been closed:

| Gap | Fix |
|---|---|
| FR-11 — `/ipos` list page had no page-level fetch time | Backend's `serverTime` field was already returned by `GET /api/ipos` and just wasn't rendered; now shown at the top of `app/ipos/page.js` |
| FR-13 — GMP notice was a short "(unofficial)" label on list rows, not the full permanent notice | New shared `components/GmpNotice.js`, now present once per page on the homepage, `/ipos`, and the detail page (which previously had its own separately-worded inline copy — now identical wording everywhere) |
| FR-14 — admin couldn't edit provisional-date fields (allotment/refund/demat/listing), and the dashboard UI exposed fewer fields than the backend allowed | `routes/admin.js`'s `EDITABLE_FIELDS` split into `PLAIN_EDITABLE_FIELDS` + `PROVISIONAL_DATE_FIELDS` with proper `{date, provisional}` validation; `app/admin/dashboard/page.js` rewritten with a full form covering identity fields, issue details, and all four timetable dates with per-field "confirmed" checkboxes |
| DU-8 — consecutive-failure alerting only existed in `refreshSubscriptions.js` | Factored into shared `lib/alerting.js`, now called from all four jobs |
| NFR-6 — no rate limiting, no robots.txt check | New `lib/rateLimiter.js` (per-source minimum request spacing, called via `throttle()` before every fetcher's outbound request) and `lib/robotsCheck.js` (fetches + parses robots.txt once per host, checked before every request; a fetch that would violate a Disallow rule now throws instead of firing) |
| NFR-8 — footer missing from `/admin/login` and `/admin/dashboard` | Both now render `<Footer />` |

Re-verified after all of the above: `npm install` succeeds cleanly on
the backend (174 packages) with the full module graph — including
every new file — loading without error; the frontend's `next build`
still compiles, lints, and generates all 7 routes correctly.

**Still not done, and still honest about it:** the fetchers' field
names remain unverified against live responses (unchanged from
before — this requires an actual live request I can't make from a
dev sandbox), and nothing has been run end-to-end against a real
deployed instance with real traffic. Rate limiting and robots.txt
checks are structurally real now, but their specific values (spacing
intervals, User-Agent string) haven't been tuned against how NSE or
investorgain.com actually respond in practice.

## Update: fetchers re-verified against real captured responses

The three NSE/investorgain fetchers were rewritten after being tested
against actual API responses (not guessed field shapes):

- **`fetchNewAndUpcomingIssues` / `fetchIssueDetails`**: NSE's real
  `ipo-detail` response is far messier than originally assumed —
  subscription figures are in `bidDetails[].noOfTime` (a decimal
  multiple, not a labeled `noOfTimesSubscribed`), and price band, lot
  size, face value, registrar name and the prospectus link are all
  buried in a free-text `issueInfo.dataList` array of `{title, value}`
  pairs rather than structured fields. A dedicated parser
  (`lib/fetchers/nseIpoDetailParser.js`) handles this, tested against
  a real captured VARMORA response — every extracted value (QIB/NII/
  retail/overall subscription, price band, face value, lot size,
  registrar) matches the source exactly. `all-upcoming-issues` alone
  is too sparse to build a full `Issue` record (no registrar, no ISIN,
  price as a string range), so discovery now does a second per-symbol
  `ipo-detail` call to enrich each new row.
- **Two fields NSE genuinely doesn't provide**: a registrar allotment
  URL (bridged via a small hand-maintained lookup by registrar name —
  `REGISTRAR_ALLOTMENT_URLS` in the parser file) and a cleanly
  parseable total issue size in ₹ crore (the free-text field mixes
  fresh-issue money and OFS share-count in a format that varies per
  IPO — `Issue.issueSizeCr` is now nullable rather than guessed at,
  fillable via the admin override).
- **`fetchGreyMarketPremium`**: fixed after seeing the real table —
  the GMP value is column index 1, not 2 as originally guessed, and
  row-matching now uses each row's stable `/gmp/<slug>/` URL (via
  `data/gmpNameMapping.json`) instead of a free-text company-name
  substring match.
- **`fetchListingResult` / `GET /api/quote-equity`**: confirmed
  returning "Access Denied" in live testing, even with a valid
  session cookie. A `Referer` header (the standard suggested fix for
  this specific NSE endpoint) has been added, but is **unverified** —
  I could not confirm it resolves the block. If it keeps failing in
  production, see the caveat in `issueFetcher.js` for fallback options
  (residential IP, BSE's equivalent endpoint, or a paid data vendor).

## Diagnosing the `quote-equity` Access Denied

Run this from a **normal home internet connection** (not from Vercel,
not from any cloud VM) to tell whether it's an IP-block or a
JS-challenge:

```bash
curl -s -D - -o /tmp/body.html "https://www.nseindia.com" \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -c /tmp/nse_cookies.txt > /tmp/headers1.txt

curl -s -D - -o /tmp/quote.json "https://www.nseindia.com/api/quote-equity?symbol=VARMORA" \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://www.nseindia.com/get-quotes/equity?symbol=VARMORA" \
  -b /tmp/nse_cookies.txt

cat /tmp/quote.json
```

- **Works from home, fails from Vercel** → confirmed IP-block. This
  endpoint will never work reliably from the deployed cron job as-is.
- **Fails even from home** → JS-challenge; no plain HTTP client fix
  exists for this without a headless browser.

`fetchListingResult` in `lib/fetchers/issueFetcher.js` now has a
3-tier fallback: NSE directly → an optional configured market-data
provider (`LISTING_PRICE_PROVIDER` in `.env`, currently stubbed for
Twelve Data — wire in whichever vendor you actually use) → give up and
let the admin fill `listingPrice`/`listingGainPercent` in manually via
the override endpoint. No automated source beats a human-verified
number here; a fabricated one is worse than none (§5's core
principle).

## Frontend UI rebuild (Tailwind CSS)

The frontend was rebuilt from inline styles to Tailwind CSS with a
deliberate design system, not just utility classes bolted onto the
old layout:

- **Fonts**: Space Grotesk (headings/brand), IBM Plex Sans (body),
  IBM Plex Mono (every numeric financial figure — price, %,
  subscription multiple — a deliberate choice: trading terminals
  conventionally use tabular/monospace numerals for data so it reads
  as data rather than prose). Loaded via `next/font/google` in
  `app/layout.js`, which **fetches font files at build time** — this
  needs internet access during `next build`/`next dev` (normal for
  any Next.js project using `next/font/google`, not specific to this
  codebase).
- **Color**: a single decisive brand color (deep emerald) plus gold
  reserved *only* for time-urgency (closing-today, the live pulse
  dot) and conventional red/green reserved *only* for actual
  gain/loss figures — color encodes meaning, not decoration.
- **`components/StatusTracker.js`** (new): a 4-stage visual tracker
  on the detail page (Upcoming → Open → Closed → Listed), mirroring
  FR-10's own state diagram. A staged/numbered UI element is only
  used here because the content genuinely is a fixed sequence.
- **`components/FilterBar.js`**: switched from a `<select>` + submit
  form to plain link-chips. Still fully NFR-3-compliant (works with
  JS off) and arguably stronger — a link needs no submit step at all.
- Every page is responsive mobile-first: the IPO card grid collapses
  from 4 columns to 2 on narrow screens, the filter bar stacks
  vertically, the admin edit form's field groups wrap naturally.
  Verified via a full `next build` (which SSG-renders every static
  route and exercises every component's render path).
