from datetime import timedelta

from django.utils import timezone

from apps.core.testing import BaseAPITestCase, make_admin, make_citizen, make_request
from apps.service_requests import services
from apps.service_requests.domain import Category, Severity, Status
from apps.service_requests.models import ServiceRequest

URL = "/api/analytics/summary/"


class SummaryTestCase(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.alice = make_citizen(email="alice@example.test")
        self.bob = make_citizen(email="bob@example.test")
        self.client.force_login(self.admin)

    def advance(self, request, *statuses):
        for status in statuses:
            services.change_status(service_request=request, new_status=status, actor=self.admin)

    def summary(self, **params):
        response = self.client.get(URL, params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data


class SummaryNumbersTests(SummaryTestCase):
    def test_empty_system_reports_zeros(self):
        data = self.summary()
        self.assertEqual(data["totals"], {"total": 0, "pending": 0, "in_progress": 0, "resolved": 0, "unresolved": 0})
        self.assertEqual(data["resolution_rate"], 0)
        self.assertIsNone(data["avg_resolution_hours"])
        self.assertEqual(len(data["by_category"]), 6)

    def test_totals_match_the_real_records(self):
        for _ in range(3):
            make_request(self.alice)
        in_progress = [make_request(self.bob) for _ in range(2)]
        resolved = make_request(self.bob)
        for request in in_progress:
            self.advance(request, Status.IN_PROGRESS)
        self.advance(resolved, Status.IN_PROGRESS, Status.RESOLVED)

        totals = self.summary()["totals"]
        self.assertEqual(totals, {"total": 6, "pending": 3, "in_progress": 2, "resolved": 1, "unresolved": 5})

        # Cross-check each figure against a direct database count.
        self.assertEqual(totals["total"], ServiceRequest.objects.count())
        for key, status in (("pending", Status.PENDING), ("in_progress", Status.IN_PROGRESS), ("resolved", Status.RESOLVED)):
            self.assertEqual(totals[key], ServiceRequest.objects.filter(status=status).count(), key)

    def test_unresolved_is_distinct_from_resolved_and_adds_up(self):
        a, b, c = (make_request(self.alice) for _ in range(3))
        self.advance(a, Status.IN_PROGRESS, Status.RESOLVED)
        self.advance(b, Status.IN_PROGRESS)

        data = self.summary()
        totals = data["totals"]
        self.assertEqual(totals["unresolved"], totals["pending"] + totals["in_progress"])
        self.assertEqual(totals["unresolved"] + totals["resolved"], totals["total"])
        self.assertEqual(totals["unresolved"], 2)
        self.assertEqual(totals["resolved"], 1)
        self.assertEqual(data["resolution_rate"], 33.3)

    def test_figures_update_when_a_request_is_created(self):
        self.assertEqual(self.summary()["totals"]["total"], 0)
        self.client.force_login(self.alice)
        self.client.post(
            "/api/requests/",
            {"category": "roads", "location": "Thika Road", "description": "A deep pothole is damaging cars."},
        )
        self.client.force_login(self.admin)
        totals = self.summary()["totals"]
        self.assertEqual((totals["total"], totals["pending"]), (1, 1))

    def test_figures_update_when_a_status_changes_through_the_api(self):
        request = make_request(self.alice)
        self.assertEqual(self.summary()["totals"]["pending"], 1)

        url = f"/api/requests/{request.reference}/status/"
        self.client.post(url, {"status": "in_progress"})
        totals = self.summary()["totals"]
        self.assertEqual((totals["pending"], totals["in_progress"], totals["resolved"]), (0, 1, 0))

        self.client.post(url, {"status": "resolved"})
        totals = self.summary()["totals"]
        self.assertEqual((totals["pending"], totals["in_progress"], totals["resolved"]), (0, 0, 1))
        self.assertEqual(totals["unresolved"], 0)

    def test_rejected_status_changes_do_not_move_the_numbers(self):
        request = make_request(self.alice)
        self.client.post(f"/api/requests/{request.reference}/status/", {"status": "resolved"})  # illegal skip
        self.assertEqual(self.summary()["totals"]["pending"], 1)

    def test_by_category_breakdown(self):
        make_request(self.alice, category=Category.WATER)
        water_active = make_request(self.alice, category=Category.WATER)
        water_done = make_request(self.alice, category=Category.WATER)
        make_request(self.bob, category=Category.ROADS)
        self.advance(water_active, Status.IN_PROGRESS)
        self.advance(water_done, Status.IN_PROGRESS, Status.RESOLVED)

        rows = {row["category"]: row for row in self.summary()["by_category"]}
        self.assertEqual(
            rows["water"],
            {
                "category": "water", "label": "Water supply",
                "total": 3, "pending": 1, "in_progress": 1, "resolved": 1, "unresolved": 2,
            },
        )
        self.assertEqual(rows["roads"]["total"], 1)
        self.assertEqual(rows["streetlights"]["total"], 0, "categories with no requests are still listed")
        self.assertEqual(sum(r["total"] for r in rows.values()), 4)
        for row in rows.values():
            self.assertEqual(row["pending"] + row["in_progress"], row["unresolved"])
            self.assertEqual(row["unresolved"] + row["resolved"], row["total"])

    def test_high_severity_unresolved_counts_only_open_high_severity(self):
        open_high = make_request(self.alice, severity=Severity.HIGH)
        done_high = make_request(self.alice, severity=Severity.HIGH)
        make_request(self.alice, severity=Severity.LOW)
        self.advance(done_high, Status.IN_PROGRESS, Status.RESOLVED)
        self.assertEqual(self.summary()["high_severity_unresolved"], 1)
        self.advance(open_high, Status.IN_PROGRESS)
        self.assertEqual(self.summary()["high_severity_unresolved"], 1, "in progress is still unresolved")

    def test_average_resolution_time(self):
        request = make_request(self.alice)
        self.advance(request, Status.IN_PROGRESS, Status.RESOLVED)
        ServiceRequest.objects.filter(pk=request.pk).update(
            created_at=timezone.now() - timedelta(hours=5), resolved_at=timezone.now(), in_progress_at=timezone.now()
        )
        self.assertAlmostEqual(self.summary()["avg_resolution_hours"], 5.0, delta=0.1)


class SummaryTimeSeriesTests(SummaryTestCase):
    def test_series_covers_the_requested_window_with_zero_filled_days(self):
        data = self.summary(days=14)
        self.assertEqual(data["window_days"], 14)
        self.assertEqual(len(data["over_time"]), 14)
        self.assertEqual(data["over_time"][-1]["date"], timezone.localdate().isoformat())
        self.assertTrue(all(p["submitted"] == 0 and p["resolved"] == 0 for p in data["over_time"]))

    def test_submitted_and_resolved_are_bucketed_by_day(self):
        old = make_request(self.alice)
        make_request(self.alice)
        self.advance(old, Status.IN_PROGRESS, Status.RESOLVED)
        three_days_ago = timezone.now() - timedelta(days=3)
        ServiceRequest.objects.filter(pk=old.pk).update(created_at=three_days_ago)

        series = {p["date"]: p for p in self.summary(days=7)["over_time"]}
        today = timezone.localdate()
        self.assertEqual(series[today.isoformat()]["submitted"], 1)
        self.assertEqual(series[today.isoformat()]["resolved"], 1)
        self.assertEqual(series[(today - timedelta(days=3)).isoformat()]["submitted"], 1)

    def test_requests_outside_the_window_are_excluded_from_the_series_only(self):
        ancient = make_request(self.alice)
        ServiceRequest.objects.filter(pk=ancient.pk).update(created_at=timezone.now() - timedelta(days=200))
        data = self.summary(days=7)
        self.assertEqual(sum(p["submitted"] for p in data["over_time"]), 0)
        self.assertEqual(data["totals"]["total"], 1, "totals cover all time")

    def test_invalid_window_is_rejected(self):
        for days in ("0", "6", "91", "abc", "-5"):
            with self.subTest(days=days):
                response = self.client.get(URL, {"days": days})
                self.assertEqual(response.status_code, 400)
                self.assertIn("days", response.data["errors"])


class SummaryScopeTests(SummaryTestCase):
    def test_citizen_summary_counts_only_their_own_requests(self):
        make_request(self.alice)
        mine_resolved = make_request(self.alice)
        make_request(self.bob)
        make_request(self.bob)
        self.advance(mine_resolved, Status.IN_PROGRESS, Status.RESOLVED)

        self.client.force_login(self.alice)
        data = self.summary()
        self.assertEqual(data["scope"], "mine")
        self.assertEqual(data["totals"], {"total": 2, "pending": 1, "in_progress": 0, "resolved": 1, "unresolved": 1})

        self.client.force_login(self.admin)
        self.assertEqual(self.summary()["totals"]["total"], 4)
        self.assertEqual(self.summary()["scope"], "all")

    def test_anonymous_users_are_denied(self):
        self.client.logout()
        self.assertEqual(self.client.get(URL).status_code, 401)
