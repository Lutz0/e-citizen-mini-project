from unittest import mock

from django.core import mail
from django.utils import timezone

from apps.core.testing import BaseAPITestCase, make_admin, make_citizen, make_request
from apps.service_requests.domain import Status

BASE = "/api/requests/"


class StatusWorkflowTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin(full_name="Grace Admin")
        self.citizen = make_citizen(full_name="Jane Citizen")
        self.request = make_request(self.citizen)
        self.url = f"{BASE}{self.request.reference}/status/"
        self.client.force_login(self.admin)

    def advance(self, new_status, note=""):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, {"status": new_status, "note": note})

    # -- happy path --------------------------------------------------------
    def test_admin_moves_request_to_in_progress(self):
        before = timezone.now()
        response = self.advance(Status.IN_PROGRESS, "Crew scheduled for Tuesday.")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], Status.IN_PROGRESS)
        self.assertEqual(response.data["status_label"], "In Progress")
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.IN_PROGRESS)
        self.assertGreaterEqual(self.request.in_progress_at, before)
        self.assertIsNone(self.request.resolved_at)

    def test_full_lifecycle_pending_to_in_progress_to_resolved(self):
        self.assertEqual(self.advance(Status.IN_PROGRESS).status_code, 200)
        response = self.advance(Status.RESOLVED, "Lamp replaced.")

        self.assertEqual(response.status_code, 200)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.RESOLVED)
        self.assertIsNotNone(self.request.in_progress_at)
        self.assertIsNotNone(self.request.resolved_at)
        self.assertGreaterEqual(self.request.resolved_at, self.request.in_progress_at)

    def test_response_exposes_timestamps_and_next_allowed_status(self):
        response = self.advance(Status.IN_PROGRESS)
        self.assertIsNotNone(response.data["in_progress_at"])
        self.assertIsNone(response.data["resolved_at"])
        self.assertEqual(response.data["allowed_next_statuses"], [{"value": "resolved", "label": "Resolved"}])

        response = self.advance(Status.RESOLVED)
        self.assertIsNotNone(response.data["resolved_at"])
        self.assertEqual(response.data["allowed_next_statuses"], [])

    # -- invalid transitions -----------------------------------------------
    def test_cannot_skip_in_progress(self):
        response = self.advance(Status.RESOLVED)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Cannot move a request from Pending to Resolved", response.data["errors"]["status"][0])
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.PENDING)

    def test_cannot_set_the_same_status_again(self):
        response = self.advance(Status.PENDING)
        self.assertEqual(response.status_code, 400)

        self.advance(Status.IN_PROGRESS)
        self.assertEqual(self.advance(Status.IN_PROGRESS).status_code, 400)

    def test_cannot_move_backwards(self):
        self.advance(Status.IN_PROGRESS)
        response = self.advance(Status.PENDING)
        self.assertEqual(response.status_code, 400)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.IN_PROGRESS)

    def test_resolved_is_final(self):
        self.advance(Status.IN_PROGRESS)
        self.advance(Status.RESOLVED)
        for target in (Status.PENDING, Status.IN_PROGRESS, Status.RESOLVED):
            with self.subTest(target=target):
                response = self.advance(target)
                self.assertEqual(response.status_code, 400)
                self.assertIn("already resolved", response.data["errors"]["status"][0])

    def test_unknown_or_missing_status_is_rejected(self):
        for payload in ({"status": "closed"}, {"status": ""}, {}):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("status", response.data["errors"])

    def test_overlong_note_is_rejected(self):
        response = self.client.post(self.url, {"status": Status.IN_PROGRESS, "note": "x" * 501})
        self.assertEqual(response.status_code, 400)
        self.assertIn("note", response.data["errors"])

    def test_unknown_request_is_404(self):
        response = self.client.post(f"{BASE}SR-1999-ZZZZZZ/status/", {"status": Status.IN_PROGRESS})
        self.assertEqual(response.status_code, 404)

    # -- audit trail ---------------------------------------------------------
    def test_every_change_is_recorded_with_who_when_and_why(self):
        self.advance(Status.IN_PROGRESS, "Crew scheduled.")
        self.advance(Status.RESOLVED, "Fixed.")

        entries = list(self.request.status_changes.all())
        self.assertEqual(
            [(e.from_status, e.to_status) for e in entries],
            [("", "pending"), ("pending", "in_progress"), ("in_progress", "resolved")],
        )
        self.assertEqual(entries[1].changed_by, self.admin)
        self.assertEqual(entries[1].note, "Crew scheduled.")
        self.assertEqual(entries[2].changed_by, self.admin)
        self.assertLessEqual(entries[1].created_at, entries[2].created_at)

    def test_failed_transitions_leave_no_audit_entry(self):
        self.advance(Status.RESOLVED)  # rejected
        self.assertEqual(self.request.status_changes.count(), 1)

    def test_admin_sees_names_in_the_audit_trail_but_citizen_sees_service_team(self):
        self.advance(Status.IN_PROGRESS, "On it.")

        admin_view = self.client.get(f"{BASE}{self.request.reference}/").data["status_changes"]
        self.assertEqual(admin_view[1]["changed_by_name"], "Grace Admin")

        self.client.force_login(self.citizen)
        citizen_view = self.client.get(f"{BASE}{self.request.reference}/").data["status_changes"]
        self.assertEqual(citizen_view[0]["changed_by_name"], "Jane Citizen")
        self.assertEqual(citizen_view[1]["changed_by_name"], "Service team")
        self.assertNotIn("Grace", str(citizen_view))

    def test_citizens_are_offered_no_status_actions(self):
        self.client.force_login(self.citizen)
        detail = self.client.get(f"{BASE}{self.request.reference}/").data
        self.assertEqual(detail["allowed_next_statuses"], [])

    # -- notifications -----------------------------------------------------
    def test_citizen_is_emailed_when_status_changes(self):
        self.advance(Status.IN_PROGRESS, "Crew scheduled for Tuesday.")

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, [self.citizen.email])
        self.assertIn(self.request.reference, message.subject)
        self.assertIn("In Progress", message.subject)
        self.assertIn("Crew scheduled for Tuesday.", message.body)
        self.assertIn(f"/requests/{self.request.reference}", message.body)

    def test_no_email_is_sent_for_a_rejected_transition(self):
        self.advance(Status.RESOLVED)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_failure_does_not_block_the_status_change(self):
        with mock.patch("apps.service_requests.notifications.send_mail", side_effect=OSError("smtp down")):
            response = self.advance(Status.IN_PROGRESS)
        self.assertEqual(response.status_code, 200)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.IN_PROGRESS)
