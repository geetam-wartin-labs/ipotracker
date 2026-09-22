"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/api";
import { formatIstDateTime } from "../../../lib/format";
import Footer from "../../../components/Footer";

const PROVISIONAL_DATE_FIELDS = ["allotmentDate", "refundDate", "dematCreditDate", "listingDate"];
const PROVISIONAL_DATE_LABELS = {
  allotmentDate: "Allotment date",
  refundDate: "Refund date",
  dematCreditDate: "Demat credit date",
  listingDate: "Listing date",
};

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none ring-brand/30 focus:border-brand focus:ring-2";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState(null);
  const [editingSlug, setEditingSlug] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("ipoTrackerAdminToken");
    if (!t) {
      router.push("/admin/login");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    loadIssues(token);
  }, [token]);

  async function loadIssues(t) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/ipos`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("ipoTrackerAdminToken");
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setIssues(data.items);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(issue) {
    setEditingSlug(issue.slug);
    setForm({
      companyName: issue.companyName,
      exchangeIdentifier: issue.exchangeIdentifier,
      tradingSymbol: issue.tradingSymbol,
      priceBandMin: issue.priceBandMin,
      priceBandMax: issue.priceBandMax,
      lotSize: issue.lotSize,
      registrarName: issue.registrarName,
      registrarAllotmentUrl: issue.registrarAllotmentUrl,
      prospectusUrl: issue.prospectusUrl || "",
      allotmentDate: {
        date: toDateInputValue(issue.allotmentDate?.date),
        provisional: issue.allotmentDate?.provisional ?? true,
      },
      refundDate: {
        date: toDateInputValue(issue.refundDate?.date),
        provisional: issue.refundDate?.provisional ?? true,
      },
      dematCreditDate: {
        date: toDateInputValue(issue.dematCreditDate?.date),
        provisional: issue.dematCreditDate?.provisional ?? true,
      },
      listingDate: {
        date: toDateInputValue(issue.listingDate?.date),
        provisional: issue.listingDate?.provisional ?? true,
      },
      markVerified: issue.verified,
      reason: "",
    });
  }

  function updateDateField(fieldKey, patch) {
    setForm((f) => ({ ...f, [fieldKey]: { ...f[fieldKey], ...patch } }));
  }

  async function saveEdit(slug) {
    setSaving(true);
    setError(null);
    try {
      const { markVerified, reason, ...rest } = form;

      const fields = {
        companyName: rest.companyName,
        exchangeIdentifier: rest.exchangeIdentifier,
        tradingSymbol: rest.tradingSymbol,
        priceBandMin: Number(rest.priceBandMin),
        priceBandMax: Number(rest.priceBandMax),
        lotSize: Number(rest.lotSize),
        registrarName: rest.registrarName,
        registrarAllotmentUrl: rest.registrarAllotmentUrl,
        prospectusUrl: rest.prospectusUrl || null,
      };

      for (const key of PROVISIONAL_DATE_FIELDS) {
        const { date, provisional } = rest[key];
        fields[key] = date ? { date, provisional } : null;
      }

      const res = await fetch(`${API_BASE}/api/admin/ipos/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields, markVerified, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEditingSlug(null);
      await loadIssues(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("ipoTrackerAdminToken");
    router.push("/admin/login");
  }

  if (!token) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-ink">Admin — IPOs</h1>
        <button onClick={logout} className="text-xs text-ink-faint hover:text-ink-muted">
          Log out
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-stale">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {issues.map((issue) => (
          <div key={issue.slug} className="rounded-xl2 border border-border bg-paper-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-ink">{issue.companyName}</span>{" "}
                <span className="text-xs text-ink-faint">
                  ({issue.slug}) {issue.verified && "· ✓ verified"}
                </span>
                <div className="text-xs text-ink-faint">
                  Last fetched {formatIstDateTime(issue.fetchedAt)} IST from {issue.sourceUrl}
                </div>
              </div>
              {editingSlug !== issue.slug && (
                <button
                  onClick={() => startEdit(issue)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-ink-faint"
                >
                  Edit
                </button>
              )}
            </div>

            {editingSlug === issue.slug && (
              <div className="mt-4 flex flex-col gap-4">
                <fieldset className="rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs font-semibold text-ink-muted">Identity</legend>
                  <div className="flex flex-col gap-2">
                    <Field label="Company name" value={form.companyName} onChange={(v) => setForm((f) => ({ ...f, companyName: v }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Exchange identifier" value={form.exchangeIdentifier} onChange={(v) => setForm((f) => ({ ...f, exchangeIdentifier: v }))} />
                      <Field label="Trading symbol" value={form.tradingSymbol} onChange={(v) => setForm((f) => ({ ...f, tradingSymbol: v }))} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-warn">
                    DR-3 matching relies on these two — only change if certain.
                  </p>
                </fieldset>

                <fieldset className="rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs font-semibold text-ink-muted">Issue details</legend>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Price min" value={form.priceBandMin} onChange={(v) => setForm((f) => ({ ...f, priceBandMin: v }))} />
                      <Field label="Price max" value={form.priceBandMax} onChange={(v) => setForm((f) => ({ ...f, priceBandMax: v }))} />
                      <Field label="Lot size" value={form.lotSize} onChange={(v) => setForm((f) => ({ ...f, lotSize: v }))} />
                    </div>
                    <Field label="Registrar name" value={form.registrarName} onChange={(v) => setForm((f) => ({ ...f, registrarName: v }))} />
                    <Field label="Registrar allotment URL" value={form.registrarAllotmentUrl} onChange={(v) => setForm((f) => ({ ...f, registrarAllotmentUrl: v }))} />
                    <Field label="Prospectus URL" value={form.prospectusUrl} onChange={(v) => setForm((f) => ({ ...f, prospectusUrl: v }))} />
                  </div>
                </fieldset>

                <fieldset className="rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs font-semibold text-ink-muted">
                    Timetable — mark confirmed once final
                  </legend>
                  <div className="flex flex-col gap-2">
                    {PROVISIONAL_DATE_FIELDS.map((key) => (
                      <div key={key} className="flex flex-wrap items-center gap-2">
                        <label className="w-32 shrink-0 text-xs text-ink-muted">
                          {PROVISIONAL_DATE_LABELS[key]}
                        </label>
                        <input
                          type="date"
                          value={form[key]?.date || ""}
                          onChange={(e) => updateDateField(key, { date: e.target.value })}
                          className="rounded-lg border border-border px-2 py-1 text-xs"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                          <input
                            type="checkbox"
                            checked={!(form[key]?.provisional ?? true)}
                            onChange={(e) => updateDateField(key, { provisional: !e.target.checked })}
                          />
                          Confirmed
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <Field label="Reason (audit note)" value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />
                <label className="flex items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={form.markVerified}
                    onChange={(e) => setForm((f) => ({ ...f, markVerified: e.target.checked }))}
                  />
                  Mark as verified
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(issue.slug)}
                    disabled={saving}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingSlug(null)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:border-ink-faint"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 text-ink-muted">{label}</div>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}
