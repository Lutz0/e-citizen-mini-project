"""Admin dashboard queries: search, filters, sorting and pagination."""
from datetime import timedelta

from django.utils import timezone

from apps.core.testing import BaseAPITestCase, make_admin, make_citizen, make_request
from apps.service_requests import services
from apps.service_requests.domain import Category, Severity, Status
from apps.service_requests.models import ServiceRequest

URL = "/api/requests/"


class ListingTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.alice = make_citizen(email="alice@example.test", full_name="Alice Mwangi")
        self.bob = make_citizen(email="bob@example.test", full_name="Bob Otieno")

        self.light = make_request(
            self.alice, category=Category.STREETLIGHTS, location="Tom Mboya Street, Nairobi CBD",
            description="Lamp post number 14 flickers constantly after dark.", severity=Severity.LOW,
        )
        self.water = make_request(
            self.alice, category=Category.WATER, location="Kibera, Olympic estate",
            description="Burst pipe is flooding the access road and wasting water.", severity=Severity.HIGH,
        )
        self.waste = make_request(
            self.bob, category=Category.WASTE, location="Githurai 45 market",
            description="Garbage bins have been overflowing since last week.", severity=Severity.MEDIUM,
        )
        self.drain = make_request(
            self.bob, category=Category.DRAINAGE, location="Tom Mboya Street, opposite the bank",
            description="Blocked drainage causes flooding when it rains.", severity=Severity.HIGH,
        )
        services.change_status(service_request=self.water, new_status=Status.IN_PROGRESS, actor=self.admin)
        services.change_status(service_request=self.drain, new_status=Status.IN_PROGRESS, actor=self.admin)
        services.change_status(service_request=self.drain, new_status=Status.RESOLVED, actor=self.admin)
        self.client.force_login(self.admin)

    def refs(self, **params):
        response = self.client.get(URL, params)
        self.assertEqual(response.status_code, 200, response.data)
        return {r["reference"] for r in response.data["results"]}

    # -- search ------------------------------------------------------------
    def test_search_by_location(self):
        self.assertEqual(self.refs(search="Tom Mboya"), {self.light.reference, self.drain.reference})
        self.assertEqual(self.refs(search="kibera"), {self.water.reference})

    def test_search_by_keyword_in_description(self):
        self.assertEqual(self.refs(search="garbage"), {self.waste.reference})
        self.assertEqual(self.refs(search="flooding"), {self.water.reference, self.drain.reference})

    def test_search_by_reference_number(self):
        self.assertEqual(self.refs(search=self.waste.reference.lower()), {self.waste.reference})

    def test_search_matches_citizen_name_and_email_for_admins(self):
        self.assertEqual(self.refs(search="Otieno"), {self.waste.reference, self.drain.reference})
        self.assertEqual(self.refs(search="alice@example.test"), {self.light.reference, self.water.reference})

    def test_every_search_word_must_match(self):
        self.assertEqual(self.refs(search="Tom Mboya flickers"), {self.light.reference})
        self.assertEqual(self.refs(search="Tom Mboya unicorn"), set())

    def test_search_treats_wildcards_literally(self):
        self.assertEqual(self.refs(search="%"), set())
        self.assertEqual(self.refs(search="_"), set())

    def test_citizens_cannot_search_by_other_peoples_names(self):
        self.client.force_login(self.alice)
        self.assertEqual(self.refs(search="Otieno"), set())

    # -- filters -------------------------------------------------------------
    def test_filter_by_category(self):
        self.assertEqual(self.refs(category="water"), {self.water.reference})

    def test_filter_by_status(self):
        self.assertEqual(self.refs(status="pending"), {self.light.reference, self.waste.reference})
        self.assertEqual(self.refs(status="in_progress"), {self.water.reference})
        self.assertEqual(self.refs(status="resolved"), {self.drain.reference})

    def test_filter_by_severity(self):
        self.assertEqual(self.refs(severity="high"), {self.water.reference, self.drain.reference})

    def test_unresolved_filter_means_pending_plus_in_progress(self):
        self.assertEqual(
            self.refs(unresolved="true"), {self.light.reference, self.waste.reference, self.water.reference}
        )
        self.assertEqual(self.refs(unresolved="false"), {self.drain.reference})

    def test_filters_combine(self):
        self.assertEqual(self.refs(search="Tom Mboya", status="resolved"), {self.drain.reference})
        self.assertEqual(self.refs(category="water", status="pending"), set())

    def test_filter_by_submission_date(self):
        ServiceRequest.objects.filter(pk=self.light.pk).update(created_at=timezone.now() - timedelta(days=10))
        recent = timezone.localdate() - timedelta(days=2)
        old = timezone.localdate() - timedelta(days=9)
        self.assertNotIn(self.light.reference, self.refs(submitted_after=recent.isoformat()))
        self.assertEqual(self.refs(submitted_before=old.isoformat()), {self.light.reference})

    def test_invalid_filter_values_give_a_400_not_a_crash(self):
        for params in ({"status": "bogus"}, {"category": "bogus"}, {"sort": "random"}, {"submitted_after": "yesterday"}):
            with self.subTest(params=params):
                response = self.client.get(URL, params)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "validation_error")

    # -- sorting -------------------------------------------------------------
    def test_default_order_is_newest_first(self):
        response = self.client.get(URL)
        self.assertEqual(
            [r["reference"] for r in response.data["results"]],
            [self.drain.reference, self.waste.reference, self.water.reference, self.light.reference],
        )

    def test_sort_oldest_first(self):
        response = self.client.get(URL, {"sort": "oldest"})
        self.assertEqual(response.data["results"][0]["reference"], self.light.reference)

    def test_sort_by_severity_puts_high_first(self):
        response = self.client.get(URL, {"sort": "severity"})
        severities = [r["severity"] for r in response.data["results"]]
        self.assertEqual(severities, ["high", "high", "medium", "low"])


class PaginationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        citizen = make_citizen()
        for index in range(12):
            make_request(citizen, location=f"Location number {index}")
        self.client.force_login(citizen)

    def test_pages_report_metadata(self):
        response = self.client.get(URL, {"page_size": 5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(response.data["page"], 1)
        self.assertEqual(response.data["page_size"], 5)
        self.assertEqual(response.data["total_pages"], 3)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

    def test_last_page_has_the_remainder(self):
        response = self.client.get(URL, {"page_size": 5, "page": 3})
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIsNone(response.data["next"])

    def test_pages_do_not_overlap(self):
        seen = []
        for page in (1, 2, 3):
            seen += [r["reference"] for r in self.client.get(URL, {"page_size": 5, "page": page}).data["results"]]
        self.assertEqual(len(seen), len(set(seen)))
        self.assertEqual(len(seen), 12)

    def test_page_size_is_capped(self):
        response = self.client.get(URL, {"page_size": 100000})
        self.assertEqual(response.data["page_size"], 100)

    def test_default_page_size_is_ten(self):
        self.assertEqual(len(self.client.get(URL).data["results"]), 10)

    def test_out_of_range_page_is_a_clean_404(self):
        response = self.client.get(URL, {"page": 99})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "not_found")
