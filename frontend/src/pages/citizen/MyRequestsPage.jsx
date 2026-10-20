import { ClipboardList, Plus } from "lucide-react";
import { getSummary } from "../../api/analytics.js";
import { listRequests } from "../../api/requests.js";
import { StatTile } from "../../components/analytics/StatTile.jsx";
import { Container, PageHeader } from "../../components/layout/Page.jsx";
import { RequestFilters } from "../../components/requests/RequestFilters.jsx";
import { RequestResults } from "../../components/requests/RequestResults.jsx";
import { ButtonLink } from "../../components/ui/Button.jsx";
import { EmptyState } from "../../components/ui/States.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useApi } from "../../hooks/useApi.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useRequestFilters } from "../../hooks/useRequestFilters.js";

export default function MyRequestsPage() {
  useDocumentTitle("My requests");
  const { user } = useAuth();
  const { filters, page, update, setPage, apiParams } = useRequestFilters();

  const summary = useApi((signal) => getSummary({ days: 30 }, signal), "my-summary");
  const query = useApi((signal) => listRequests(apiParams, signal), apiParams);
  const totals = summary.data?.totals;

  const tile = (label, key, status, color) => (
    <StatTile
      label={label}
      value={totals?.[key] ?? 0}
      color={color}
      loading={summary.loading}
      to={status ? `/requests?status=${status}` : "/requests"}
      active={filters.status === (status ?? "") && !filters.unresolved}
    />
  );

  return (
    <Container className="py-8">
      <PageHeader
        title="My requests"
        description={`Welcome, ${user.full_name.split(" ")[0]}. Track the issues you've reported and add any new ones.`}
        actions={
          <ButtonLink to="/requests/new" icon={Plus}>
            New request
          </ButtonLink>
        }
      />

      <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile("All requests", "total", null)}
        {tile("Pending", "pending", "pending", "var(--series-pending)")}
        {tile("In Progress", "in_progress", "in_progress", "var(--series-progress)")}
        {tile("Resolved", "resolved", "resolved", "var(--series-resolved)")}
      </section>

      <div className="mb-4">
        <RequestFilters
          filters={filters}
          onChange={(changes) => update(changes, { replace: "search" in changes })}
          searchLabel="Search my requests"
          searchPlaceholder="Search by reference, location or description"
        />
      </div>

      <RequestResults
        title="My requests"
        query={query}
        filters={filters}
        page={page}
        onFiltersChange={update}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="You haven't reported anything yet"
            description="Spotted a broken streetlight, a leak or a blocked drain? Report it and we'll keep you updated."
            action={
              <ButtonLink to="/requests/new" icon={Plus}>
                Report an issue
              </ButtonLink>
            }
          />
        }
      />
    </Container>
  );
}
