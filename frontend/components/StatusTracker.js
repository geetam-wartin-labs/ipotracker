const STAGES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "listed", label: "Listed" },
];

// The IPO lifecycle genuinely is a fixed sequence (FR-10's own state
// diagram: Upcoming -> Open -> Closed -> Listed) — a numbered/staged
// treatment is warranted here, unlike most content.
export default function StatusTracker({ status }) {
  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center" aria-label="IPO status">
      {STAGES.map((stage, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const upcoming = i > currentIndex;

        return (
          <div key={stage.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  active
                    ? "bg-brand text-white"
                    : done
                      ? "bg-brand-soft text-brand-dark"
                      : "bg-ink/5 text-ink-faint"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? "text-ink" : upcoming ? "text-ink-faint" : "text-ink-muted"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`mx-1.5 h-px flex-1 ${i < currentIndex ? "bg-brand" : "bg-border"}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
