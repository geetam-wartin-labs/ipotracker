import Link from "next/link";
import StatusTracker from "../../../components/StatusTracker";
import FreshnessBadge from "../../../components/FreshnessBadge";
import GmpNotice from "../../../components/GmpNotice";
import Footer from "../../../components/Footer";
import { getIpoDetail } from "../../../lib/api";
import {
  formatIstDate,
  formatIstDateTime,
  formatRupees,
  formatCurrencyCr,
} from "../../../lib/format";

const CATEGORY_LABELS = {
  qib: "Qualified Institutional",
  nii: "Non-Institutional",
  retail: "Retail",
  employee: "Employee",
  overall: "Overall",
};

function DateRow({ label, dateInfo }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="figure font-mono font-medium text-ink">
        {formatIstDate(dateInfo?.date)}
        {dateInfo?.date && dateInfo?.provisional && (
          <span className="ml-2 font-sans text-xs font-medium text-warn">provisional</span>
        )}
      </span>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="figure font-mono font-medium text-ink">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-4 rounded-xl2 border border-border bg-paper-surface p-4 sm:p-5">
      <h2 className="mb-3 font-display text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function IpoDetailPage({ params }) {
  let ipo, loadError;
  try {
    ipo = await getIpoDetail(params.slug);
  } catch (err) {
    loadError = err.message;
  }

  if (loadError) {
    return (
      <div>
        <Link href="/ipos" className="text-sm text-ink-muted hover:text-ink">
          ← All IPOs
        </Link>
        <p className="mt-4 rounded-lg bg-stale-soft px-3 py-2 text-sm text-stale">
          Couldn&apos;t load this IPO: {loadError}
        </p>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Link href="/ipos" className="text-sm text-ink-muted hover:text-ink">
        ← All IPOs
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-semibold text-ink">{ipo.companyName}</h1>
        {ipo.closesToday && (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold">
            Closes today
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {ipo.issueType === "sme" ? "SME" : "Mainboard"} · {ipo.exchange} ·{" "}
        <span className="figure font-mono">{ipo.tradingSymbol}</span>
      </p>

      <div className="mt-4 flex items-center gap-2">
        <FreshnessBadge freshness={ipo.issueDetails.freshness} fetchedAt={ipo.issueDetails.fetchedAt} />
        {ipo.issueDetails.verified && (
          <span className="text-xs font-medium text-brand">✓ Admin-verified</span>
        )}
      </div>

      <div className="mt-5 rounded-xl2 border border-border bg-paper-surface p-4 sm:p-5">
        <StatusTracker status={ipo.status} />
      </div>

      <Section title="Timetable">
        <DateRow label="Open date" dateInfo={{ date: ipo.timetable.openDate, provisional: false }} />
        <DateRow label="Close date" dateInfo={{ date: ipo.timetable.closeDate, provisional: false }} />
        <DateRow label="Allotment" dateInfo={ipo.timetable.allotmentDate} />
        <DateRow label="Refund" dateInfo={ipo.timetable.refundDate} />
        <DateRow label="Demat credit" dateInfo={ipo.timetable.dematCreditDate} />
        <DateRow label="Listing" dateInfo={ipo.timetable.listingDate} />
      </Section>

      <Section title="Issue details">
        <Row
          label="Price band"
          value={`${formatRupees(ipo.issueDetails.priceBandMin)}–${formatRupees(
            ipo.issueDetails.priceBandMax
          )}`}
        />
        <Row label="Lot size" value={`${ipo.issueDetails.lotSize} shares`} />
        <Row label="Minimum investment" value={formatRupees(ipo.issueDetails.minInvestment)} />
        <Row label="Issue size" value={formatCurrencyCr(ipo.issueDetails.issueSizeCr)} />
        {ipo.issueDetails.freshIssueCr != null && (
          <Row label="Fresh issue" value={formatCurrencyCr(ipo.issueDetails.freshIssueCr)} />
        )}
        {ipo.issueDetails.offerForSaleCr != null && (
          <Row label="Offer for sale" value={formatCurrencyCr(ipo.issueDetails.offerForSaleCr)} />
        )}
        <Row label="Face value" value={formatRupees(ipo.issueDetails.faceValue)} />
        <Row label="Registrar" value={ipo.issueDetails.registrarName} />

        {/* FR-9 */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <a
            href={ipo.issueDetails.registrarAllotmentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Check allotment status ↗
          </a>
          {ipo.issueDetails.prospectusUrl && (
            <a
              href={ipo.issueDetails.prospectusUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
            >
              Prospectus ↗
            </a>
          )}
        </div>
      </Section>

      <Section title="Subscription">
        {Object.entries(ipo.subscription).map(([category, fig]) => (
          <div
            key={category}
            className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
          >
            <span className="text-ink-muted">{CATEGORY_LABELS[category]}</span>
            <span className="flex items-center gap-2">
              <span className="figure font-mono font-medium text-ink">
                {fig.value != null ? `${fig.value}x` : "—"}
              </span>
              <FreshnessBadge dense freshness={fig.freshness} fetchedAt={fig.fetchedAt} />
            </span>
          </div>
        ))}
      </Section>

      <Section title="Grey Market Premium">
        <div className="flex items-center justify-between border-b border-border py-2 text-sm">
          <span className="text-ink-muted">Premium</span>
          <span className="flex items-center gap-2">
            <span
              className={`figure font-mono font-medium ${
                ipo.greyMarketPremium.value != null && ipo.greyMarketPremium.value < 0
                  ? "text-loss"
                  : "text-ink"
              }`}
            >
              {ipo.greyMarketPremium.value != null ? formatRupees(ipo.greyMarketPremium.value) : "—"}
              {ipo.greyMarketPremium.impliedGainPercent != null &&
                ` (${ipo.greyMarketPremium.impliedGainPercent}%)`}
            </span>
            <FreshnessBadge
              dense
              freshness={ipo.greyMarketPremium.freshness}
              fetchedAt={ipo.greyMarketPremium.fetchedAt}
            />
          </span>
        </div>
        <div className="pt-3">
          <GmpNotice />
        </div>
      </Section>

      {ipo.listing.listingPrice != null && (
        <Section title="Listing result">
          <Row label="Listing price" value={formatRupees(ipo.listing.listingPrice)} />
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-ink-muted">Listing gain</span>
            <span
              className={`figure font-mono font-medium ${
                ipo.listing.listingGainPercent < 0 ? "text-loss" : "text-gain"
              }`}
            >
              {ipo.listing.listingGainPercent > 0 ? "+" : ""}
              {ipo.listing.listingGainPercent}%
            </span>
          </div>
        </Section>
      )}

      <p className="figure mt-5 font-mono text-xs text-ink-faint">
        Server responded at {formatIstDateTime(ipo.serverTime)} IST.
      </p>

      <Footer />
    </div>
  );
}
