"""Analytics are computed on demand with aggregate queries over the request
table. Nothing is cached or stored separately, so the numbers can never drift
from the real records: create a request or change a status and the next call
reflects it."""
from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.service_requests.domain import Category, Severity, Status


def build_summary(queryset, *, days=30):
    """Summarise ``queryset`` (already scoped to what the caller may see)."""
    resolved_q = Q(status=Status.RESOLVED)
    unresolved_q = ~resolved_q

    aggregate = queryset.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status=Status.PENDING)),
        in_progress=Count("id", filter=Q(status=Status.IN_PROGRESS)),
        resolved=Count("id", filter=resolved_q),
        high_severity_unresolved=Count("id", filter=Q(severity=Severity.HIGH) & unresolved_q),
        avg_resolution=Avg(
            ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField()),
            filter=resolved_q,
        ),
    )

    total = aggregate["total"]
    resolved = aggregate["resolved"]
    avg_resolution = aggregate["avg_resolution"]

    return {
        "totals": {
            "total": total,
            "pending": aggregate["pending"],
            "in_progress": aggregate["in_progress"],
            "resolved": resolved,
            "unresolved": aggregate["pending"] + aggregate["in_progress"],
        },
        "resolution_rate": round(resolved / total * 100, 1) if total else 0.0,
        "avg_resolution_hours": round(avg_resolution.total_seconds() / 3600, 1) if avg_resolution else None,
        "high_severity_unresolved": aggregate["high_severity_unresolved"],
        "by_category": _by_category(queryset, resolved_q, unresolved_q),
        "over_time": _over_time(queryset, days),
        "window_days": days,
    }


def _by_category(queryset, resolved_q, unresolved_q):
    rows = {
        row["category"]: row
        for row in queryset.order_by()
        .values("category")
        .annotate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=Status.PENDING)),
            in_progress=Count("id", filter=Q(status=Status.IN_PROGRESS)),
            resolved=Count("id", filter=resolved_q),
            unresolved=Count("id", filter=unresolved_q),
        )
    }
    # Always return every category (zero-filled) so charts have a stable shape.
    counts = ("total", "pending", "in_progress", "resolved", "unresolved")
    return [
        {
            "category": category.value,
            "label": category.label,
            **{name: rows.get(category.value, {}).get(name, 0) for name in counts},
        }
        for category in Category
    ]


def _over_time(queryset, days):
    """Requests submitted and resolved per day for the last ``days`` days (zero-filled)."""
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)

    submitted = {
        row["day"]: row["n"]
        for row in queryset.filter(created_at__date__gte=start)
        .order_by()
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(n=Count("id"))
    }
    resolved = {
        row["day"]: row["n"]
        for row in queryset.filter(resolved_at__date__gte=start)
        .order_by()
        .annotate(day=TruncDate("resolved_at"))
        .values("day")
        .annotate(n=Count("id"))
    }

    series = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        series.append(
            {
                "date": day.isoformat(),
                "submitted": submitted.get(day, 0),
                "resolved": resolved.get(day, 0),
            }
        )
    return series
