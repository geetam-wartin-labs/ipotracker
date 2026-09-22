const STYLES = {
  upcoming: "bg-ink/5 text-ink-muted",
  open: "bg-brand-soft text-brand-dark",
  closed: "bg-ink/5 text-ink-muted",
  listed: "bg-gold-soft text-gold",
};
const LABELS = {
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
  listed: "Listed",
};

export default function StatusBadge({ status, closesToday }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          STYLES[status] || STYLES.upcoming
        }`}
      >
        {status === "open" && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
        )}
        {LABELS[status] || "Upcoming"}
      </span>
      {/* FR-4: closing-today rows visually distinguished — gold for
          urgency, kept separate from red (reserved for loss figures). */}
      {closesToday && (
        <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold">
          Closes today
        </span>
      )}
    </span>
  );
}
