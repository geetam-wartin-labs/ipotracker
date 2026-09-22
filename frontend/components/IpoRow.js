import Link from "next/link";
import StatusBadge from "./StatusBadge";
import FreshnessBadge from "./FreshnessBadge";
import { formatIstDate, formatRupees } from "../lib/format";

export default function IpoRow({ ipo }) {
  const gmpValue = ipo.greyMarketPremium.value;
  const gmpIsNegative = gmpValue != null && gmpValue < 0;

  return (
    <Link
      href={`/ipos/${ipo.slug}`}
      className={`block rounded-xl2 border border-border p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/30 ${
        ipo.closesToday ? "bg-gold-soft/40" : "bg-paper-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[15px] font-semibold text-ink">
            {ipo.companyName}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {ipo.issueType === "sme" ? "SME" : "Mainboard"} · {ipo.exchange} ·{" "}
            {formatIstDate(ipo.openDate)}–{formatIstDate(ipo.closeDate)}
          </p>
        </div>
        <StatusBadge status={ipo.status} closesToday={ipo.closesToday} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <div className="text-[11px] text-ink-faint">Price band</div>
          <div className="figure font-mono text-sm font-medium text-ink">
            {formatRupees(ipo.priceBandMin)}–{formatRupees(ipo.priceBandMax)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-faint">Lot size</div>
          <div className="figure font-mono text-sm font-medium text-ink">
            {ipo.lotSize} sh
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-faint">Subscription</div>
          <div className="figure font-mono text-sm font-medium text-ink">
            {ipo.overallSubscription.value != null ? `${ipo.overallSubscription.value}x` : "—"}
          </div>
          <div className="mt-1">
            <FreshnessBadge
              dense
              freshness={ipo.overallSubscription.freshness}
              fetchedAt={ipo.overallSubscription.fetchedAt}
            />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-faint">GMP</div>
          <div
            className={`figure font-mono text-sm font-medium ${
              gmpIsNegative ? "text-loss" : "text-ink"
            }`}
          >
            {gmpValue != null ? formatRupees(gmpValue) : "—"}
          </div>
          <div className="mt-1">
            <FreshnessBadge
              dense
              freshness={ipo.greyMarketPremium.freshness}
              fetchedAt={ipo.greyMarketPremium.fetchedAt}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
