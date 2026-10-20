"""Business logic for service requests.

Views and serializers stay thin and delegate here, so every rule (who may do
what, which status changes are legal, what gets audited) lives in one place and
is enforced no matter which entry point is used.
"""
from functools import partial

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from . import notifications
from .domain import Severity, Status, allowed_next_statuses, can_transition
from .models import Comment, ServiceRequest, StatusChange


class InvalidStatusTransition(Exception):
    """Raised when a requested status change breaks the lifecycle rules."""

    def __init__(self, current, requested):
        self.current = current
        self.requested = requested
        current_label = Status(current).label
        requested_label = Status(requested).label
        allowed = [Status(s).label for s in allowed_next_statuses(current)]
        if allowed:
            hint = f"The only allowed next status is {' or '.join(allowed)}."
        else:
            hint = "This request is already resolved and can no longer change status."
        super().__init__(f"Cannot move a request from {current_label} to {requested_label}. {hint}")


@transaction.atomic
def create_request(*, citizen, category, location, description, severity=Severity.MEDIUM, image=None):
    """Create a request in the ``pending`` state and record the submission in the audit trail."""
    if not citizen.is_citizen:
        raise PermissionDenied("Only citizens can submit service requests.")

    reference = ServiceRequest.generate_reference()
    while ServiceRequest.objects.filter(reference=reference).exists():  # unique constraint is the backstop
        reference = ServiceRequest.generate_reference()

    service_request = ServiceRequest.objects.create(
        reference=reference,
        citizen=citizen,
        category=category,
        location=location,
        description=description,
        severity=severity,
        image=image,
        status=Status.PENDING,
    )
    StatusChange.objects.create(
        service_request=service_request,
        from_status="",
        to_status=Status.PENDING,
        changed_by=citizen,
        note="Request submitted.",
    )
    return service_request


@transaction.atomic
def change_status(*, service_request, new_status, actor, note=""):
    """Move a request to ``new_status`` on behalf of an administrator.

    The row is locked and re-read first, so two administrators acting at the
    same moment cannot both apply a transition from the same starting state.
    """
    if not actor.is_administrator:
        raise PermissionDenied("Only administrators can change a request's status.")

    locked = ServiceRequest.objects.select_for_update().get(pk=service_request.pk)
    if not can_transition(locked.status, new_status):
        raise InvalidStatusTransition(locked.status, new_status)

    previous_status = locked.status
    now = timezone.now()
    locked.status = new_status
    if new_status == Status.IN_PROGRESS:
        locked.in_progress_at = now
    elif new_status == Status.RESOLVED:
        locked.resolved_at = now
    locked.save(update_fields=["status", "in_progress_at", "resolved_at", "updated_at"])

    StatusChange.objects.create(
        service_request=locked,
        from_status=previous_status,
        to_status=new_status,
        changed_by=actor,
        note=note,
    )
    transaction.on_commit(partial(notifications.notify_status_change, locked.pk, note))
    return locked


def add_comment(*, service_request, author, body):
    """Add a comment. Only the owning citizen or an administrator may comment."""
    if not (author.is_administrator or service_request.citizen_id == author.pk):
        raise PermissionDenied("You cannot comment on this request.")
    return Comment.objects.create(service_request=service_request, author=author, body=body)
