import re

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.core.testing import make_citizen, make_request
from apps.service_requests import services
from apps.service_requests.domain import (
    ALLOWED_TRANSITIONS,
    Status,
    allowed_next_statuses,
    can_transition,
)
from apps.service_requests.models import ServiceRequest


class LifecycleRulesTests(TestCase):
    def test_only_forward_single_steps_are_allowed(self):
        self.assertEqual(allowed_next_statuses(Status.PENDING), (Status.IN_PROGRESS,))
        self.assertEqual(allowed_next_statuses(Status.IN_PROGRESS), (Status.RESOLVED,))
        self.assertEqual(allowed_next_statuses(Status.RESOLVED), ())

    def test_every_other_transition_is_forbidden(self):
        allowed = {(a, b) for a, targets in ALLOWED_TRANSITIONS.items() for b in targets}
        for current in Status:
            for target in Status:
                with self.subTest(current=current, target=target):
                    self.assertEqual(can_transition(current, target), (current, target) in allowed)


class ServiceRequestModelTests(TestCase):
    def setUp(self):
        self.citizen = make_citizen()

    def test_new_request_defaults_to_pending_with_system_timestamps(self):
        before = timezone.now()
        request = make_request(self.citizen)
        self.assertEqual(request.status, Status.PENDING)
        self.assertGreaterEqual(request.created_at, before)
        self.assertIsNone(request.in_progress_at)
        self.assertIsNone(request.resolved_at)

    def test_reference_numbers_are_readable_and_unique(self):
        references = {make_request(self.citizen).reference for _ in range(25)}
        self.assertEqual(len(references), 25)
        for reference in references:
            self.assertRegex(reference, re.compile(r"^SR-\d{4}-[A-HJKMNP-Z2-9]{6}$"))

    def test_creating_a_request_records_the_submission_in_the_audit_trail(self):
        request = make_request(self.citizen)
        entry = request.status_changes.get()
        self.assertEqual(entry.from_status, "")
        self.assertEqual(entry.to_status, Status.PENDING)
        self.assertEqual(entry.changed_by, self.citizen)

    def test_database_rejects_status_that_contradicts_timestamps(self):
        request = make_request(self.citizen)
        with self.assertRaises(IntegrityError), transaction.atomic():
            # "resolved" without a resolved_at timestamp must be impossible.
            ServiceRequest.objects.filter(pk=request.pk).update(status=Status.RESOLVED)
        with self.assertRaises(IntegrityError), transaction.atomic():
            # "pending" must not carry a resolved_at timestamp.
            ServiceRequest.objects.filter(pk=request.pk).update(resolved_at=timezone.now())

    def test_citizen_with_requests_cannot_be_deleted(self):
        make_request(self.citizen)
        from django.db.models import ProtectedError

        with self.assertRaises(ProtectedError):
            self.citizen.delete()


class ServiceLayerAuthorisationTests(TestCase):
    """Rules are enforced in the service layer too, not only in the views."""

    def test_service_refuses_status_change_by_a_non_admin(self):
        from django.core.exceptions import PermissionDenied

        citizen = make_citizen()
        request = make_request(citizen)
        with self.assertRaises(PermissionDenied):
            services.change_status(service_request=request, new_status=Status.IN_PROGRESS, actor=citizen)
        request.refresh_from_db()
        self.assertEqual(request.status, Status.PENDING)

    def test_stale_object_cannot_apply_a_transition_twice(self):
        from apps.core.testing import make_admin

        admin = make_admin()
        request = make_request(make_citizen())
        stale_copy = ServiceRequest.objects.get(pk=request.pk)

        services.change_status(service_request=request, new_status=Status.IN_PROGRESS, actor=admin)
        with self.assertRaises(services.InvalidStatusTransition):
            # The stale copy still *thinks* the request is pending; the locked re-read must catch it.
            services.change_status(service_request=stale_copy, new_status=Status.IN_PROGRESS, actor=admin)
        self.assertEqual(request.status_changes.count(), 2)  # submission + one transition
