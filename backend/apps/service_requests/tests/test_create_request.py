from django.utils import timezone

from apps.core.testing import (
    REQUEST_PAYLOAD,
    BaseAPITestCase,
    image_upload,
    make_admin,
    make_citizen,
)
from apps.service_requests.domain import Status
from apps.service_requests.models import ServiceRequest

URL = "/api/requests/"


class CreateRequestTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.citizen = make_citizen()
        self.client.force_login(self.citizen)

    def test_citizen_can_submit_a_request(self):
        before = timezone.now()
        response = self.client.post(URL, REQUEST_PAYLOAD)

        self.assertEqual(response.status_code, 201, response.data)
        body = response.data
        self.assertRegex(body["reference"], r"^SR-\d{4}-[A-Z0-9]{6}$")
        self.assertEqual(body["status"], Status.PENDING)
        self.assertEqual(body["status_label"], "Pending")
        self.assertEqual(body["category"], "streetlights")
        self.assertEqual(body["location"], REQUEST_PAYLOAD["location"])
        self.assertFalse(body["has_image"])
        self.assertEqual(body["citizen"]["email"], self.citizen.email)

        stored = ServiceRequest.objects.get(reference=body["reference"])
        self.assertEqual(stored.citizen, self.citizen)
        self.assertGreaterEqual(stored.created_at, before, "submission date is recorded by the system")
        self.assertEqual(len(body["status_changes"]), 1)
        self.assertEqual(body["status_changes"][0]["to_status"], Status.PENDING)

    def test_request_persists_in_the_database(self):
        self.client.post(URL, REQUEST_PAYLOAD)
        self.assertEqual(ServiceRequest.objects.filter(citizen=self.citizen).count(), 1)

    def test_severity_defaults_to_medium(self):
        payload = {k: v for k, v in REQUEST_PAYLOAD.items() if k != "severity"}
        response = self.client.post(URL, payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["severity"], "medium")

    def test_all_six_categories_are_accepted(self):
        for category in ("streetlights", "water", "waste", "roads", "drainage", "other"):
            with self.subTest(category=category):
                response = self.client.post(URL, {**REQUEST_PAYLOAD, "category": category})
                self.assertEqual(response.status_code, 201)

    def test_multipart_submission_with_an_image(self):
        response = self.client.post(
            URL, {**REQUEST_PAYLOAD, "image": image_upload()}, format="multipart"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["has_image"])

    def test_client_cannot_override_system_controlled_fields(self):
        other = make_citizen(email="other@example.test")
        response = self.client.post(
            URL,
            {
                **REQUEST_PAYLOAD,
                "status": "resolved",
                "citizen": other.pk,
                "reference": "SR-2000-AAAAAA",
                "created_at": "2001-01-01T00:00:00Z",
                "resolved_at": "2001-01-01T00:00:00Z",
            },
        )
        self.assertEqual(response.status_code, 201)
        stored = ServiceRequest.objects.get(reference=response.data["reference"])
        self.assertEqual(stored.status, Status.PENDING)
        self.assertEqual(stored.citizen, self.citizen)
        self.assertNotEqual(stored.reference, "SR-2000-AAAAAA")
        self.assertGreater(stored.created_at.year, 2020)
        self.assertIsNone(stored.resolved_at)

    def test_text_fields_are_trimmed(self):
        response = self.client.post(
            URL, {**REQUEST_PAYLOAD, "location": "   Kenyatta Avenue   ", "description": "  " + REQUEST_PAYLOAD["description"] + "  "}
        )
        self.assertEqual(response.data["location"], "Kenyatta Avenue")
        self.assertEqual(response.data["description"], REQUEST_PAYLOAD["description"])


class CreateRequestValidationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(make_citizen())

    def assertRejected(self, payload, field, expected_fragment=None):
        response = self.client.post(URL, payload)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertIn(field, response.data["errors"])
        if expected_fragment:
            self.assertIn(expected_fragment, response.data["errors"][field][0])
        self.assertEqual(ServiceRequest.objects.count(), 0, "nothing may be saved when validation fails")

    def test_empty_submission_reports_every_required_field(self):
        response = self.client.post(URL, {})
        self.assertEqual(response.status_code, 400)
        for field in ("category", "location", "description"):
            self.assertIn(field, response.data["errors"])
        self.assertNotIn("severity", response.data["errors"])

    def test_unknown_category_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "category": "potholes"}, "category", "Select a category")

    def test_missing_location_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "location": ""}, "location")

    def test_whitespace_only_location_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "location": "     "}, "location")

    def test_too_short_description_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "description": "broken"}, "description", "at least 10")

    def test_too_long_description_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "description": "x" * 2001}, "description", "2000")

    def test_too_long_location_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "location": "x" * 256}, "location", "255")

    def test_invalid_severity_is_rejected(self):
        self.assertRejected({**REQUEST_PAYLOAD, "severity": "catastrophic"}, "severity")


class CreateRequestAuthorisationTests(BaseAPITestCase):
    def test_anonymous_users_cannot_submit(self):
        response = self.client.post(URL, REQUEST_PAYLOAD)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(ServiceRequest.objects.count(), 0)

    def test_administrators_do_not_submit_requests(self):
        self.client.force_login(make_admin())
        response = self.client.post(URL, REQUEST_PAYLOAD)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(ServiceRequest.objects.count(), 0)
