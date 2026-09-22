// Server-only fetch helper. Every call here happens in a Server
// Component (NFR-3: pages are server-rendered, no client-side
// scripting dependency to display data), so `cache: "no-store"` means
// each page request goes to the backend fresh — the freshness the
// backend reports is then genuinely the freshness the visitor sees.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getHomepageOpenToday() {
  return apiGet("/api/ipos?openToday=true");
}

export function getHomepageUpcoming(days = 14) {
  return apiGet(`/api/ipos?upcomingDays=${days}`);
}

export function getIpoList({ status, type, page = 1 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  params.set("page", String(page));
  return apiGet(`/api/ipos?${params.toString()}`);
}

export function getIpoDetail(slug) {
  return apiGet(`/api/ipos/${encodeURIComponent(slug)}`);
}

export { API_BASE };
