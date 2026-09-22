import { formatIstDateTime, relativeAge } from "../lib/format";

// FR-11/FR-12: every figure carries its own fetch time.
// DU-2: past warn, the fetch time is emphasised (bolder text).
// DU-3: past stale, the value is not presented as current — the
// "Stale" label itself is the notice.
const STYLES = {
  current: "bg-brand-soft text-brand-dark",
  warn: "bg-warn-soft text-warn font-semibold",
  stale: "bg-stale-soft text-stale font-semibold",
};
const LABELS = {
  current: "Live",
  warn: "Delayed",
  stale: "Stale",
};

export default function FreshnessBadge({ freshness, fetchedAt, dense = false }) {
  const style = STYLES[freshness] || STYLES.stale;
  const label = LABELS[freshness] || "Stale";

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-mono ${
        dense ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${style}`}
      title={fetchedAt ? formatIstDateTime(fetchedAt) : "No fetch recorded yet"}
    >
      {freshness === "current" && (
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
      )}
      {label} · {fetchedAt ? relativeAge(fetchedAt) : "no data"}
    </span>
  );
}
