import IpoRow from "../components/IpoRow";
import Footer from "../components/Footer";
import GmpNotice from "../components/GmpNotice";
import { getHomepageOpenToday, getHomepageUpcoming } from "../lib/api";
import { formatIstDateTime } from "../lib/format";

export default async function HomePage() {
  let openToday, upcoming, loadError;

  try {
    [openToday, upcoming] = await Promise.all([
      getHomepageOpenToday(),
      getHomepageUpcoming(14),
    ]);
  } catch (err) {
    loadError = err.message;
  }

  if (loadError) {
    return (
      <div>
        <p className="rounded-lg bg-stale-soft px-3 py-2 text-sm text-stale">
          Couldn&apos;t reach the data service right now: {loadError}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          This page will show current data again once the service responds.
        </p>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      {/* Functional hero: live status, not marketing copy */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-border bg-paper-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
          <span className="font-display text-sm font-semibold text-ink">
            {openToday.items.length} IPO{openToday.items.length === 1 ? "" : "s"} open
            for subscription today
          </span>
        </div>
        <span className="figure font-mono text-xs text-ink-faint">
          as of {formatIstDateTime(openToday.serverTime)} IST
        </span>
      </div>

      <GmpNotice />

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Open today</h2>
          <span className="text-xs text-ink-faint">sorted by closing date</span>
        </div>
        {openToday.items.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
            No IPOs are open today.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openToday.items.map((ipo) => (
              <IpoRow key={ipo.slug} ipo={ipo} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          Opening in the next 14 days
        </h2>
        {upcoming.items.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
            Nothing opening soon.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {upcoming.items.map((ipo) => (
              <IpoRow key={ipo.slug} ipo={ipo} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
