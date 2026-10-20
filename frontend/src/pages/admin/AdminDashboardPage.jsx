import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Clock3, Flag, Inbox, Percent } from "lucide-react";
import { getSummary } from "../../api/analytics.js";
import { listRequests } from "../../api/requests.js";
import { CategoryChart } from "../../components/analytics/CategoryChart.jsx";
import { StatTile } from "../../components/analytics/StatTile.jsx";
import { StatusMixBar } from "../../components/analytics/StatusMixBar.jsx";
import { TrendChart } from "../../components/analytics/TrendChart.jsx";
import { Container, PageHeader } from "../../components/layout/Page.jsx";
import { RequestFilters } from "../../components/requests/RequestFilters.jsx";
import { RequestResults } from "../../components/requests/RequestResults.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Skeleton } from "../../components/ui/Loading.jsx";
import { EmptyState, ErrorState } from "../../components/ui/States.jsx";
import { useApi } from "../../hooks/useApi.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useRequestFilters } from "../../hooks/useRequestFilters.js";
import { formatHours } from "../../utils/format.js";

const TREND_DAYS = 30;

function Insight({ icon: Icon, label, value, to }) {
  const body = (
    <>
      <Icon className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        <p className="text-lg font-semibold text-ink">{value}</p>
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="flex items-center gap-3 rounded-lg p-2 hover:bg-brand-50">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-2">{body}</div>
  );
}

export default function AdminDashboardPage() {
  useDocumentTitle("Administration dashboard");
  const location = useLocation();
  const { filters, page, update, setPage, apiParams } = useRequestFilters();

  const summary = useApi((signal) => getSummary({ days: TREND_DAYS }, signal), "admin-summary");
  const query = useApi((signal) => listRequests(apiParams, signal), apiParams);

  // Stat tiles link to "/admin?status=…#requests": jump down to the filtered table.
  useEffect(() => {
    if (location.hash === "#requests") {
      document.getElementById("requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.key, location.hash]);

  const data = summary.data;
  const totals = data?.totals;
  const tileProps = { loading: summary.loading };
  const isFilter = (status) => filters.status === status && !filters.unresolved && !filters.severity;
  const noOtherFilters = !filters.status && !filters.unresolved && !filters.severity && !filters.category && !filters.search;

  return (
    <Container className="py-8">
      <PageHeader
        title="Administration dashboard"
        description="Review incoming requests, update their status and keep an eye on progress. Figures are calculated live from the database."
      />

      {/* Headline numbers */}
      <section aria-label="Summary" className="grid grid-cols-6 gap-3 lg:grid-cols-5">
        <StatTile {...tileProps} className="col-span-3 lg:col-span-1" label="Total requests" value={totals?.total ?? 0} to="/admin#requests" active={noOtherFilters} />
        <StatTile
          {...tileProps}
          className="col-span-3 lg:col-span-1"
          emphasis
          label="Unresolved"
          value={totals?.unresolved ?? 0}
          hint="Pending + In Progress"
          to="/admin?unresolved=true#requests"
          active={Boolean(filters.unresolved)}
        />
        <StatTile
          {...tileProps}
          className="col-span-2 lg:col-span-1"
          label="Pending"
          color="var(--series-pending)"
          value={totals?.pending ?? 0}
          to="/admin?status=pending#requests"
          active={isFilter("pending")}
        />
        <StatTile
          {...tileProps}
          className="col-span-2 lg:col-span-1"
          label="In Progress"
          color="var(--series-progress)"
          value={totals?.in_progress ?? 0}
          to="/admin?status=in_progress#requests"
          active={isFilter("in_progress")}
        />
        <StatTile
          {...tileProps}
          className="col-span-2 lg:col-span-1"
          label="Resolved"
          color="var(--series-resolved)"
          value={totals?.resolved ?? 0}
          to="/admin?status=resolved#requests"
          active={isFilter("resolved")}
        />
      </section>

      {summary.error && !data ? (
        <Card className="mt-6">
          <ErrorState error={summary.error} onRetry={summary.reload} title="We couldn't load the statistics" />
        </Card>
      ) : (
        <>
          {/* Unresolved vs resolved */}
          <Card as="section" aria-labelledby="mix-heading" className="mt-6">
            <CardHeader id="mix-heading" title="Unresolved vs resolved" description="How all requests split across the three statuses" />
            <div className="p-5">
              {totals ? <StatusMixBar totals={totals} /> : <Skeleton className="h-16 w-full" />}
              <div className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
                <Insight icon={Percent} label="Resolution rate" value={data ? `${data.resolution_rate}%` : "–"} />
                <Insight icon={Clock3} label="Avg. time to resolve" value={data ? formatHours(data.avg_resolution_hours) : "–"} />
                <Insight
                  icon={Flag}
                  label="High severity, unresolved"
                  value={data ? data.high_severity_unresolved : "–"}
                  to="/admin?severity=high&unresolved=true#requests"
                />
              </div>
            </div>
          </Card>

          {/* Charts */}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {data ? (
              <>
                <CategoryChart rows={data.by_category} refreshing={summary.refreshing} />
                <TrendChart points={data.over_time} days={data.window_days} refreshing={summary.refreshing} />
              </>
            ) : (
              <>
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
              </>
            )}
          </div>
        </>
      )}

      {/* Request management */}
      <section id="requests" aria-labelledby="requests-heading" className="mt-10 scroll-mt-4">
        <h2 id="requests-heading" className="mb-4 text-xl font-bold tracking-tight">
          All requests
        </h2>
        <div className="mb-4">
          <RequestFilters
            filters={filters}
            onChange={(changes) => update(changes, { replace: "search" in changes })}
            searchLabel="Search requests by keyword, location, reference or citizen"
            searchPlaceholder="Search keyword, location, reference or citizen"
          />
        </div>
        {filters.unresolved && (
          <p className="mb-3 text-sm text-ink-2">
            Showing <strong>unresolved</strong> requests (Pending and In Progress).
          </p>
        )}
        <RequestResults
          title="All requests"
          query={query}
          filters={filters}
          page={page}
          onFiltersChange={update}
          onPageChange={setPage}
          showCitizen
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No requests yet"
              description="When citizens submit requests they will appear here."
            />
          }
        />
      </section>
    </Container>
  );
}
