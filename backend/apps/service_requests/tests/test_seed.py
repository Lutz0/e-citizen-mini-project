import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import Role, User
from apps.analytics.services import build_summary
from apps.core.testing import PASSWORD, BaseAPITestCase
from apps.service_requests.domain import Status
from apps.service_requests.models import ServiceRequest


def seed(*args):
    out = StringIO()
    call_command("seed_demo", *args, stdout=out)
    return out.getvalue()


class SeedDemoTests(BaseAPITestCase):
    def test_refuses_to_run_outside_debug_without_force(self):
        with self.assertRaisesMessage(CommandError, "DEBUG"):
            seed(f"--password={PASSWORD}")
        self.assertEqual(User.objects.count(), 0)

    def test_seeds_accounts_and_consistent_requests(self):
        output = seed(f"--password={PASSWORD}", "--force")

        self.assertEqual(User.objects.filter(role=Role.ADMIN).count(), 1)
        self.assertEqual(User.objects.filter(role=Role.CITIZEN).count(), 3)
        self.assertTrue(User.objects.get(email="admin@example.test").check_password(PASSWORD))
        self.assertNotIn(PASSWORD, output, "a supplied password is never echoed back")

        # Spread across every status, with an audit trail matching the final state.
        for status in Status:
            self.assertTrue(ServiceRequest.objects.filter(status=status).exists(), status)
        for request in ServiceRequest.objects.all():
            trail = [change.to_status for change in request.status_changes.all()]
            expected = {Status.PENDING: ["pending"], Status.IN_PROGRESS: ["pending", "in_progress"],
                        Status.RESOLVED: ["pending", "in_progress", "resolved"]}[request.status]
            self.assertEqual(trail, expected, request.reference)
            self.assertLessEqual(request.created_at, request.updated_at)

        totals = build_summary(ServiceRequest.objects.all())["totals"]
        self.assertEqual(totals["total"], ServiceRequest.objects.count())
        self.assertEqual(totals["unresolved"] + totals["resolved"], totals["total"])

    def test_generates_and_prints_a_password_when_none_is_given(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("DEMO_PASSWORD", None)  # hermetic: don't depend on the developer's shell
            output = seed("--force")
        self.assertIn("Generated password", output)

    def test_password_can_come_from_the_environment_and_is_not_echoed(self):
        with mock.patch.dict(os.environ, {"DEMO_PASSWORD": PASSWORD}):
            output = seed("--force")
        self.assertTrue(User.objects.get(email="admin@example.test").check_password(PASSWORD))
        self.assertNotIn(PASSWORD, output)
        self.assertNotIn("Generated password", output)

    def test_second_run_needs_reset(self):
        seed(f"--password={PASSWORD}", "--force")
        count = ServiceRequest.objects.count()
        with self.assertRaisesMessage(CommandError, "--reset"):
            seed(f"--password={PASSWORD}", "--force")
        seed(f"--password={PASSWORD}", "--force", "--reset")
        self.assertEqual(ServiceRequest.objects.count(), count)
        self.assertEqual(User.objects.count(), 4)
