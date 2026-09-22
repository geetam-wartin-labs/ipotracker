// DR-5: all timestamps are stored in UTC and displayed in IST.
const IST_TZ = "Asia/Kolkata";

export function formatIstDateTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatIstDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatIstTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "As of 3:45 PM IST" / "Updated 12 min ago" style helper for the badges. */
export function relativeAge(isoString) {
  if (!isoString) return "no data yet";
  const ms = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCurrencyCr(value) {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")} Cr`;
}

export function formatRupees(value) {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}
