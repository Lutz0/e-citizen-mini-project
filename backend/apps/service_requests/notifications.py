"""Outbound email notifications (bonus feature).

Sending is best-effort: a mail-server problem must never roll back or fail the
status change that triggered it, so errors are logged and swallowed.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

from .domain import Status
from .models import ServiceRequest

logger = logging.getLogger(__name__)

_HEADLINES = {
    Status.IN_PROGRESS: "Work has started on your request.",
    Status.RESOLVED: "Your request has been marked as resolved.",
}


def notify_status_change(service_request_id, note=""):
    """Email the citizen that their request moved to a new status."""
    try:
        service_request = ServiceRequest.objects.select_related("citizen").get(pk=service_request_id)
        citizen = service_request.citizen
        status_label = service_request.get_status_display()
        headline = _HEADLINES.get(service_request.status, f"Status updated to {status_label}.")

        lines = [
            f"Hello {citizen.get_short_name()},",
            "",
            headline,
            "",
            f"Reference:  {service_request.reference}",
            f"Category:   {service_request.get_category_display()}",
            f"Location:   {service_request.location}",
            f"New status: {status_label}",
        ]
        if note:
            lines += ["", "Message from the service team:", note]
        lines += [
            "",
            f"Track your request: {settings.FRONTEND_URL}/requests/{service_request.reference}",
            "",
            "Public Service Request System",
        ]

        send_mail(
            subject=f"[{service_request.reference}] Your request is now {status_label}",
            message="\n".join(lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[citizen.email],
            fail_silently=False,
        )
    except Exception:  # noqa: BLE001 - notification failures must not propagate
        logger.exception("Could not send status-change email for service request %s", service_request_id)
