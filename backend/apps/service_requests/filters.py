import django_filters
from django.db.models import Case, IntegerField, Q, Value, When

from .domain import UNRESOLVED_STATUSES, Category, Severity, Status
from .models import ServiceRequest

SORT_CHOICES = (
    ("newest", "Newest first"),
    ("oldest", "Oldest first"),
    ("severity", "Highest severity first"),
    ("updated", "Recently updated"),
)

MAX_SEARCH_TERMS = 6
MAX_TERM_LENGTH = 100


class ServiceRequestFilter(django_filters.FilterSet):
    """Query-string filters for the request list.

    Works for both audiences: because the view scopes the queryset to what the
    user may see *before* filtering, a citizen can only ever search their own
    requests while an administrator searches everything.
    """

    status = django_filters.ChoiceFilter(choices=Status.choices)
    category = django_filters.ChoiceFilter(choices=Category.choices)
    severity = django_filters.ChoiceFilter(choices=Severity.choices)
    unresolved = django_filters.BooleanFilter(method="filter_unresolved", help_text="Pending + In Progress")
    search = django_filters.CharFilter(method="filter_search")
    submitted_after = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    submitted_before = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    sort = django_filters.ChoiceFilter(choices=SORT_CHOICES, method="filter_sort", empty_label=None)

    class Meta:
        model = ServiceRequest
        fields = []

    def filter_unresolved(self, queryset, name, value):
        if value is None:
            return queryset
        statuses = [s.value for s in UNRESOLVED_STATUSES]
        return queryset.filter(status__in=statuses) if value else queryset.exclude(status__in=statuses)

    def filter_search(self, queryset, name, value):
        """Every word must match somewhere (reference, location, description, category,
        and - for administrators only - the citizen's name or email)."""
        user = self.request.user
        for term in value.split()[:MAX_SEARCH_TERMS]:
            term = term[:MAX_TERM_LENGTH]
            condition = (
                Q(reference__icontains=term)
                | Q(location__icontains=term)
                | Q(description__icontains=term)
                | Q(category__icontains=term)
            )
            if user.is_authenticated and user.is_administrator:
                condition |= Q(citizen__full_name__icontains=term) | Q(citizen__email__icontains=term)
            queryset = queryset.filter(condition)
        return queryset

    def filter_sort(self, queryset, name, value):
        if value == "oldest":
            return queryset.order_by("created_at", "id")
        if value == "updated":
            return queryset.order_by("-updated_at", "-id")
        if value == "severity":
            rank = Case(
                When(severity=Severity.HIGH, then=Value(3)),
                When(severity=Severity.MEDIUM, then=Value(2)),
                default=Value(1),
                output_field=IntegerField(),
            )
            return queryset.annotate(_severity_rank=rank).order_by("-_severity_rank", "-created_at", "-id")
        return queryset.order_by("-created_at", "-id")
