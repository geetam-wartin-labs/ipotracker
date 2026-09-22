/**
 * Parses the real shape of NSE's GET /api/ipo-detail?symbol=X&series=Y
 * response, captured live on 22 Sep 2026 for VARMORA. This is NOT the
 * shape originally guessed — see git history / PR discussion for the
 * before/after. Key differences from the guess:
 *
 *   - Subscription is in `bidDetails[]`, field `noOfTime` (not
 *     `noOfTimesSubscribed`), already expressed as a decimal multiple
 *     (0.073 means 0.073x, not 7.3x) — no rescaling needed, just
 *     parseFloat.
 *   - Category labels are full phrases:
 *       "Qualified Institutional Buyers(QIBs)"
 *       "Non Institutional Investors"          (the srNo "2" row —
 *         NOT the "2.1"/"2.2" sub-buckets, which are included in the
 *         same array and must be excluded by exact label match)
 *       "Retail Individual Investors(RIIs)"
 *       "Total"                                 (srNo is null)
 *     An "Employee" category was not present in the captured sample
 *     (this IPO has no employee reservation) — handled as optional.
 *   - Price band, lot size, face value, registrar name and the RHP
 *     link are NOT separate fields; they're buried in
 *     `issueInfo.dataList`, an array of {title, value} free-text
 *     pairs, e.g. {"title": "Price Range", "value": "Rs. 140 to
 *     Rs. 148 per Equity Share"}. Every extraction below is a
 *     best-effort regex against that text and returns null on
 *     failure rather than guessing — per DU-5, a field we can't
 *     confidently parse should be left unset (and the whole record
 *     rejected upstream if a required field comes back null), not
 *     filled with a wrong value.
 */

const CATEGORY_LABELS = {
  qib: "Qualified Institutional Buyers(QIBs)",
  nii: "Non Institutional Investors",
  retail: "Retail Individual Investors(RIIs)",
  overall: "Total",
};

/** Returns { timesSubscribed: number } | null for one category. */
function parseSubscriptionForCategory(ipoDetailResponse, category) {
  const rows = ipoDetailResponse?.bidDetails;
  if (!Array.isArray(rows)) return null;

  let row;
  if (category === "employee") {
    // No confirmed label from a real sample — match loosely, but only
    // for this one category, and only as a best-effort.
    row = rows.find((r) => /employee/i.test(r.category || ""));
  } else {
    const label = CATEGORY_LABELS[category];
    if (!label) return null;
    row = rows.find((r) => r.category === label);
  }

  if (!row || row.noOfTime === "" || row.noOfTime == null) return null;

  const value = parseFloat(row.noOfTime);
  if (Number.isNaN(value)) return null;

  return { timesSubscribed: value };
}

function findInfoValue(dataList, title) {
  if (!Array.isArray(dataList)) return null;
  const row = dataList.find((r) => r.title === title);
  return row ? row.value : null;
}

/** "Rs. 140 to Rs. 148 per Equity Share" -> { min: 140, max: 148 } | null */
function parsePriceRange(dataList) {
  const raw = findInfoValue(dataList, "Price Range");
  if (!raw) return null;
  const match = raw.match(/Rs\.?\s*([\d,.]+)\s*to\s*Rs\.?\s*([\d,.]+)/i);
  if (!match) return null;
  const min = Number(match[1].replace(/,/g, ""));
  const max = Number(match[2].replace(/,/g, ""));
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return { min, max };
}

/** "Rs. 2 per Equity Share" -> 2 | null */
function parseFaceValue(dataList) {
  const raw = findInfoValue(dataList, "Face Value");
  if (!raw) return null;
  const match = raw.match(/Rs\.?\s*([\d,.]+)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isNaN(value) ? null : value;
}

/** "101 Equity Shares and in multiples thereof" -> 101 | null.
 *  Falls back to SME's "lotSize" field on the discovery-endpoint row,
 *  which the caller should pass if this returns null. */
function parseBidLot(dataList) {
  const raw = findInfoValue(dataList, "Bid Lot");
  if (!raw) return null;
  const match = raw.match(/^\s*([\d,]+)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isNaN(value) ? null : value;
}

/** "KFin Technologies Limited" (sometimes with escaped quotes) */
function parseRegistrarName(dataList) {
  const raw = findInfoValue(dataList, "Name of the Registrar");
  if (!raw) return null;
  return raw.replace(/^"+|"+$/g, "").trim() || null;
}

/** Direct URL string, or null. */
function parseProspectusUrl(dataList) {
  const raw = findInfoValue(dataList, "Red Herring Prospectus");
  if (!raw) return null;
  return /^https?:\/\//.test(raw) ? raw : null;
}

/**
 * NSE's ipo-detail response has NO field for the registrar's
 * allotment-status page — genuinely absent from the captured sample,
 * not a parsing miss. This is a small hand-maintained lookup by
 * registrar name, covering the handful of firms that handle nearly
 * all Indian IPOs. Add entries as new registrars are seen; an
 * unmapped registrar returns null (caller must then skip
 * registrarAllotmentUrl, which is a required field on Issue — so an
 * unmapped registrar should hold up creating/updating that issue
 * until either mapped here or the admin fills it in manually).
 */
const REGISTRAR_ALLOTMENT_URLS = {
  "kfin technologies": "https://kosmic.kfintech.com/ipostatus/",
  "link intime": "https://linkintime.co.in/initial_offer/public-issues.html",
  bigshare: "https://ipo.bigshareonline.com/IPO_Status.html",
  cameo: "https://ipo.cameoindia.com/",
  "skyline financial": "https://www.skylinerta.com/ipo.php",
  "integrated registry": "https://www.integratedindia.in/allotment_status.aspx",
};

function lookupRegistrarAllotmentUrl(registrarName) {
  if (!registrarName) return null;
  const key = Object.keys(REGISTRAR_ALLOTMENT_URLS).find((k) =>
    registrarName.toLowerCase().includes(k)
  );
  return key ? REGISTRAR_ALLOTMENT_URLS[key] : null;
}

/**
 * Full best-effort extraction of slow-changing issue fields from one
 * ipo-detail response. Any field that fails to parse is null on the
 * returned object — callers decide whether a null in a required
 * field means "skip this record" or "leave the existing value alone"
 * (DU-4: a failed/partial fetch never overwrites with a blank).
 */
function parseIssueDetailFields(ipoDetailResponse) {
  const dataList = ipoDetailResponse?.issueInfo?.dataList;
  const priceRange = parsePriceRange(dataList);
  const registrarName = parseRegistrarName(dataList);

  return {
    priceBandMin: priceRange?.min ?? null,
    priceBandMax: priceRange?.max ?? null,
    faceValue: parseFaceValue(dataList),
    lotSize: parseBidLot(dataList),
    registrarName,
    registrarAllotmentUrl: lookupRegistrarAllotmentUrl(registrarName),
    prospectusUrl: parseProspectusUrl(dataList),
  };
}

module.exports = {
  parseSubscriptionForCategory,
  parseIssueDetailFields,
  lookupRegistrarAllotmentUrl,
};
