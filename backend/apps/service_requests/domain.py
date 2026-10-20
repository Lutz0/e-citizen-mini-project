"""Domain vocabulary and rules for service requests.

Kept free of any web/serialisation concerns so the rules can be read (and
tested) in one place.
"""
from django.db import models


class Category(models.TextChoices):
    STREETLIGHTS = "streetlights", "Streetlights"
    WATER = "water", "Water supply"
    WASTE = "waste", "Waste collection"
    ROADS = "roads", "Roads"
    DRAINAGE = "drainage", "Drainage"
    OTHER = "other", "Other"


class Status(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    RESOLVED = "resolved", "Resolved"


class Severity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


# The request lifecycle is strictly forward-only, one step at a time:
#     Pending -> In Progress -> Resolved
# Skipping a step, moving backwards or "re-applying" the current status are all
# rejected. Resolved is a terminal state.
ALLOWED_TRANSITIONS = {
    Status.PENDING: (Status.IN_PROGRESS,),
    Status.IN_PROGRESS: (Status.RESOLVED,),
    Status.RESOLVED: (),
}

UNRESOLVED_STATUSES = (Status.PENDING, Status.IN_PROGRESS)


def allowed_next_statuses(current_status):
    """Statuses a request may move to from ``current_status``."""
    return ALLOWED_TRANSITIONS.get(current_status, ())


def can_transition(current_status, new_status):
    return new_status in allowed_next_statuses(current_status)
