import Link from "next/link";

// FR-5/FR-6: filterable, URL-encoded. Plain <a> links — no JS
// dependency at all (stronger than a form: a link works even with
// JS disabled and no submit step), fully satisfying NFR-3.
function buildHref(current, patch) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.type) params.set("type", next.type);
  const qs = params.toString();
  return qs ? `/ipos?${qs}` : "/ipos";
}

function Chip({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-brand text-white"
          : "bg-ink/5 text-ink-muted hover:bg-ink/10 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default function FilterBar({ status, type }) {
  const current = { status, type };
  const STATUSES = [
    { value: "", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "listed", label: "Listed" },
  ];
  const TYPES = [
    { value: "", label: "All" },
    { value: "mainboard", label: "Mainboard" },
    { value: "sme", label: "SME" },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Chip
            key={s.value || "all"}
            href={buildHref(current, { status: s.value })}
            active={(status || "") === s.value}
          >
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <Chip
            key={t.value || "all"}
            href={buildHref(current, { type: t.value })}
            active={(type || "") === t.value}
          >
            {t.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
