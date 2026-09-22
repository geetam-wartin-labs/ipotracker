/**
 * FR-10: status is derived from the current date and the issue's
 * open/close/listing dates — it is never stored as an editable field.
 *
 *   Upcoming --(open date reached)--> Open
 *   Open     --(close date passed)--> Closed
 *   Closed   --(listing date reached)--> Listed
 *
 * All comparisons are done on UTC instants (DR-5: everything is
 * stored in UTC; conversion to IST happens only at display time).
 */
function deriveStatus(issue, now = new Date()) {
  const open = issue.openDate ? new Date(issue.openDate) : null;
  const close = issue.closeDate ? new Date(issue.closeDate) : null;
  const listing =
    issue.listingDate && issue.listingDate.date ? new Date(issue.listingDate.date) : null;

  if (listing && now >= listing) return "listed";
  if (close && now > close) return "closed";
  if (open && now >= open) return "open";
  return "upcoming";
}

/** FR-4: is this IPO closing today (IST calendar day)? */
function closesToday(issue, now = new Date()) {
  if (!issue.closeDate) return false;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(now.getTime() + IST_OFFSET_MS);
  const closeIst = new Date(new Date(issue.closeDate).getTime() + IST_OFFSET_MS);
  return (
    nowIst.getUTCFullYear() === closeIst.getUTCFullYear() &&
    nowIst.getUTCMonth() === closeIst.getUTCMonth() &&
    nowIst.getUTCDate() === closeIst.getUTCDate()
  );
}

/** FR-2: is this IPO opening within the next N days (default 14)? */
function opensWithinDays(issue, days = 14, now = new Date()) {
  if (!issue.openDate) return false;
  const open = new Date(issue.openDate);
  const diffMs = open.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

module.exports = { deriveStatus, closesToday, opensWithinDays };
