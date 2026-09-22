import IpoRow from "../../components/IpoRow";
import FilterBar from "../../components/FilterBar";
import Footer from "../../components/Footer";
import GmpNotice from "../../components/GmpNotice";
import { getIpoList } from "../../lib/api";
import { formatIstDateTime } from "../../lib/format";

export default async function IpoListPage({ searchParams }) {
  const status = searchParams?.status || "";
  const type = searchParams?.type || "";
  const page = Number(searchParams?.page || 1);

  let data, loadError;
  try {
    data = await getIpoList({ status, type, page });
  } catch (err) {
    loadError = err.message;
  }

  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">All IPOs</h1>
      {data && (
        <p className="figure mt-1 font-mono text-xs text-ink-faint">
          as of {formatIstDateTime(data.serverTime)} IST
        </p>
      )}

      <div className="my-5">
        <FilterBar status={status} type={type} />
      </div>

      <GmpNotice />

      {loadError && (
        <p className="mt-4 rounded-lg bg-stale-soft px-3 py-2 text-sm text-stale">
          Couldn&apos;t reach the data service right now: {loadError}
        </p>
      )}

      {data && (
        <>
          <p className="mb-3 mt-5 text-xs text-ink-faint">
            {data.total} result{data.total === 1 ? "" : "s"}
          </p>
          {data.items.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
              No IPOs match these filters.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.items.map((ipo) => (
                <IpoRow key={ipo.slug} ipo={ipo} />
              ))}
            </div>
          )}
        </>
      )}

      <Footer />
    </div>
  );
}
