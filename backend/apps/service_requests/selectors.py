"""Read-side queries. All data access that depends on *who is asking* lives here."""
from django.db.models import Prefetch

from .models import Comment, ServiceRequest, StatusChange


def visible_requests(user):
    """Requests ``user`` is allowed to see.

    Administrators see everything; citizens see only their own. Scoping at the
    queryset level means other people's requests are simply "not found" - their
    existence is not even revealed.
    """
    queryset = ServiceRequest.objects.select_related("citizen")
    if not user.is_authenticated or not user.is_active:
        return queryset.none()
    if user.is_administrator:
        return queryset
    return queryset.filter(citizen=user)


def with_detail_relations(queryset):
    """Prefetch the audit trail and comments needed by the detail view."""
    return queryset.prefetch_related(
        Prefetch("status_changes", queryset=StatusChange.objects.select_related("changed_by")),
        Prefetch("comments", queryset=Comment.objects.select_related("author")),
    )
