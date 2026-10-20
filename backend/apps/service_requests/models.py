import os
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from .domain import Category, Severity, Status

# No 0/O/1/I/L: reference numbers are read out over the phone and typed by hand.
REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def request_image_path(instance, filename):
    """Store uploads under a random name; the client-supplied name is discarded."""
    extension = os.path.splitext(filename)[1].lower()
    return f"service_requests/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}"


class ServiceRequest(models.Model):
    """A citizen's report of a local community issue."""

    reference = models.CharField(
        max_length=20, unique=True, editable=False, help_text="Public case number, e.g. SR-2026-K7M3Q9."
    )
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,  # never silently delete the public record of a report
        related_name="service_requests",
    )
    category = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    location = models.CharField(max_length=255, help_text="Address, area or landmark.")
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    image = models.ImageField(upload_to=request_image_path, blank=True, null=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True, help_text="Submission date (set by the system).")
    updated_at = models.DateTimeField(auto_now=True)
    in_progress_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["citizen", "-created_at"], name="sr_citizen_created_idx"),
            models.Index(fields=["status", "category"], name="sr_status_category_idx"),
        ]
        constraints = [
            # Status and lifecycle timestamps can never disagree, whatever code path wrote them.
            models.CheckConstraint(
                condition=(
                    Q(status=Status.PENDING, in_progress_at__isnull=True, resolved_at__isnull=True)
                    | Q(status=Status.IN_PROGRESS, in_progress_at__isnull=False, resolved_at__isnull=True)
                    | Q(status=Status.RESOLVED, resolved_at__isnull=False)
                ),
                name="sr_status_matches_timestamps",
            ),
        ]

    def __str__(self):
        return f"{self.reference} ({self.get_status_display()})"

    @staticmethod
    def generate_reference():
        year = timezone.now().year
        suffix = "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(6))
        return f"SR-{year}-{suffix}"


class StatusChange(models.Model):
    """Audit trail: one immutable row per lifecycle event of a request."""

    service_request = models.ForeignKey(
        ServiceRequest, on_delete=models.CASCADE, related_name="status_changes"
    )
    from_status = models.CharField(
        max_length=20, choices=Status.choices, blank=True, help_text="Empty for the initial submission."
    )
    to_status = models.CharField(max_length=20, choices=Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="status_changes"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.service_request.reference}: {self.from_status or '-'} -> {self.to_status}"


class Comment(models.Model):
    """Conversation on a request between the citizen and administrators."""

    service_request = models.ForeignKey(
        ServiceRequest, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="comments"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Comment by {self.author_id} on {self.service_request_id}"
