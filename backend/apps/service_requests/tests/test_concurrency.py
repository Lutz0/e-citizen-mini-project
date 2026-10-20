"""Row-locking behaviour. Needs a database with real row locks (PostgreSQL); skipped on SQLite,
which serialises all writes anyway."""
import threading

from django.db import connections
from django.test import TransactionTestCase, skipUnlessDBFeature

from apps.core.testing import make_admin, make_citizen, make_request
from apps.service_requests import services
from apps.service_requests.domain import Status


@skipUnlessDBFeature("has_select_for_update")
class ConcurrentStatusChangeTests(TransactionTestCase):
    def test_two_administrators_cannot_both_apply_the_same_transition(self):
        admins = [make_admin("a@example.test"), make_admin("b@example.test")]
        request = make_request(make_citizen())

        barrier = threading.Barrier(2)  # make both threads hit the database at the same moment
        outcomes = []

        def work(actor):
            try:
                barrier.wait(timeout=10)
                services.change_status(service_request=request, new_status=Status.IN_PROGRESS, actor=actor)
                outcomes.append("applied")
            except services.InvalidStatusTransition:
                outcomes.append("rejected")
            finally:
                connections.close_all()  # each thread has its own connection

        threads = [threading.Thread(target=work, args=(admin,)) for admin in admins]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        self.assertEqual(sorted(outcomes), ["applied", "rejected"])
        # Submission + exactly ONE transition: no duplicate audit row, no lost update.
        self.assertEqual(request.status_changes.count(), 2)
        request.refresh_from_db()
        self.assertEqual(request.status, Status.IN_PROGRESS)
