import { SearchX } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import { Pagination } from "../ui/Pagination.jsx";
import { EmptyState, ErrorState } from "../ui/States.jsx";
import { RequestList, RequestListSkeleton } from "./RequestList.jsx";
import { EMPTY_FILTERS, hasActiveFilters } from "./RequestFilters.jsx";
import { PAGE_SIZE } from "../../hooks/useRequestFilters.js";

/**
 * The results panel shared by the citizen and administrator screens.
 * Handles every state: first load, refresh, error, empty (with and without
 * filters) and the populated, paginated list.
 */
export function RequestResults({ query, filters, page, onFiltersChange, onPageChange, showCitizen, emptyState, title }) {
  const { data, error, loading, refreshing, reload } = query;

  let body;
  if (loading) {
    body = <RequestListSkeleton />;
  } else if (error && error.status === 404 && page > 1) {
    // e.g. a bookmarked page number that no longer exists
    body = (
      <EmptyState
        icon={SearchX}
        title="That page doesn't exist"
        description="There are fewer results than when this link was created."
        action={<Button onClick={() => onPageChange(1)}>Go to the first page</Button>}
      />
    );
  } else if (error && !data) {
    body = <ErrorState error={error} onRetry={reload} title="We couldn't load the requests" />;
  } else if (data && data.count === 0) {
    body = hasActiveFilters(filters) ? (
      <EmptyState
        icon={SearchX}
        title="No requests match your filters"
        description="Try a different search or clear the filters to see everything."
        action={
          <Button variant="secondary" onClick={() => onFiltersChange({ ...EMPTY_FILTERS, sort: filters.sort })}>
            Clear filters
          </Button>
        }
      />
    ) : (
      emptyState
    );
  } else if (data) {
    body = <RequestList requests={data.results} showCitizen={showCitizen} />;
  }

  return (
    <Card as="section" aria-label={title} aria-busy={refreshing || undefined}>
      {error && data && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
          <span>{error.detail}</span>
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {/* Refetch keeps the frame: previous results stay put, slightly dimmed, while new ones load. */}
      <div className={`transition-opacity ${refreshing ? "opacity-60" : ""}`}>{body}</div>
      {data && data.count > 0 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          count={data.count}
          pageSize={data.page_size || PAGE_SIZE}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
}
