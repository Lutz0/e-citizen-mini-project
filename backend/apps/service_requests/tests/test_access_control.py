"""Who may see and do what. Every protected endpoint is exercised for each kind of caller."""
from apps.core.testing import (
    BaseAPITestCase,
    image_upload,
    make_admin,
    make_citizen,
    make_request,
    read_streamed,
)
from apps.service_requests import services
from apps.service_requests.domain import Status

LIST_URL = "/api/requests/"


class AnonymousAccessTests(BaseAPITestCase):
    """Unauthenticated users are denied everywhere (401)."""

    def setUp(self):
        super().setUp()
        self.request = make_request(make_citizen())
        self.detail = f"{LIST_URL}{self.request.reference}/"

    def test_every_protected_endpoint_returns_401(self):
        endpoints = [
            ("get", LIST_URL),
            ("post", LIST_URL),
            ("get", self.detail),
            ("post", f"{self.detail}status/"),
            ("get", f"{self.detail}comments/"),
            ("post", f"{self.detail}comments/"),
            ("get", f"{self.detail}image/"),
            ("get", "/api/analytics/summary/"),
            ("get", "/api/auth/me/"),
        ]
        for method, url in endpoints:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, {} if method == "post" else None)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["code"], "not_authenticated")

    def test_nothing_was_changed_by_anonymous_attempts(self):
        self.client.post(f"{self.detail}status/", {"status": Status.IN_PROGRESS})
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Status.PENDING)


class CitizenIsolationTests(BaseAPITestCase):
    """Citizens can access and manage only their own requests."""

    def setUp(self):
        super().setUp()
        self.alice = make_citizen(email="alice@example.test", full_name="Alice")
        self.bob = make_citizen(email="bob@example.test", full_name="Bob")
        self.alice_request = make_request(self.alice, location="Alice's street")
        self.bob_request = make_request(self.bob, location="Bob's street")
        self.client.force_login(self.alice)

    def test_list_contains_only_own_requests(self):
        response = self.client.get(LIST_URL)
        self.assertEqual(response.status_code, 200)
        references = [r["reference"] for r in response.data["results"]]
        self.assertEqual(references, [self.alice_request.reference])
        self.assertEqual(response.data["count"], 1)

    def test_can_open_own_request(self):
        response = self.client.get(f"{LIST_URL}{self.alice_request.reference}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reference"], self.alice_request.reference)

    def test_cannot_open_another_citizens_request(self):
        response = self.client.get(f"{LIST_URL}{self.bob_request.reference}/")
        # 404 rather than 403: we don't even confirm that the reference exists.
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("Bob", str(response.data))

    def test_cannot_read_or_write_comments_on_another_citizens_request(self):
        url = f"{LIST_URL}{self.bob_request.reference}/comments/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.post(url, {"body": "hello"}).status_code, 404)
        self.assertEqual(self.bob_request.comments.count(), 0)

    def test_cannot_download_another_citizens_image(self):
        self.client.force_login(self.bob)
        created = self.client.post(
            LIST_URL,
            {"category": "water", "location": "Bob's tap", "description": "No water for three days now.", "image": image_upload()},
            format="multipart",
        )
        self.assertEqual(created.status_code, 201)
        url = f"{LIST_URL}{created.data['reference']}/image/"
        own = self.client.get(url)
        self.assertEqual(own.status_code, 200)
        read_streamed(own)

        self.client.force_login(self.alice)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_search_never_leaks_other_citizens_requests(self):
        response = self.client.get(LIST_URL, {"search": "Bob's street"})
        self.assertEqual(response.data["count"], 0)

    def test_reference_lookup_is_case_insensitive_but_still_scoped(self):
        lower = self.alice_request.reference.lower()
        self.assertEqual(self.client.get(f"{LIST_URL}{lower}/").status_code, 200)
        self.assertEqual(self.client.get(f"{LIST_URL}{self.bob_request.reference.lower()}/").status_code, 404)

    def test_citizen_cannot_see_other_citizens_data_in_analytics(self):
        make_request(self.bob)
        response = self.client.get("/api/analytics/summary/")
        self.assertEqual(response.data["scope"], "mine")
        self.assertEqual(response.data["totals"]["total"], 1)


class NonAdminCannotChangeStatusTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.alice = make_citizen(email="alice@example.test")
        self.bob = make_citizen(email="bob@example.test")
        self.alice_request = make_request(self.alice)
        self.url = f"{LIST_URL}{self.alice_request.reference}/status/"

    def assertStillPending(self):
        self.alice_request.refresh_from_db()
        self.assertEqual(self.alice_request.status, Status.PENDING)
        self.assertEqual(self.alice_request.status_changes.count(), 1)

    def test_owner_cannot_change_status(self):
        self.client.force_login(self.alice)
        response = self.client.post(self.url, {"status": Status.IN_PROGRESS})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "permission_denied")
        self.assertStillPending()

    def test_other_citizen_cannot_change_status(self):
        self.client.force_login(self.bob)
        response = self.client.post(self.url, {"status": Status.IN_PROGRESS})
        self.assertEqual(response.status_code, 403)
        self.assertStillPending()

    def test_patch_and_put_are_not_available_for_editing_requests(self):
        self.client.force_login(self.alice)
        detail = f"{LIST_URL}{self.alice_request.reference}/"
        for method in ("patch", "put", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(detail, {"status": "resolved"})
                self.assertEqual(response.status_code, 405)
        self.assertStillPending()

    def test_deactivated_admin_loses_access(self):
        admin = make_admin()
        self.client.force_login(admin)
        admin.is_active = False
        admin.save()
        response = self.client.post(self.url, {"status": Status.IN_PROGRESS})
        self.assertIn(response.status_code, (401, 403))
        self.assertStillPending()


class AdministratorAccessTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.alice = make_citizen(email="alice@example.test", full_name="Alice")
        self.bob = make_citizen(email="bob@example.test", full_name="Bob")
        self.alice_request = make_request(self.alice)
        self.bob_request = make_request(self.bob)
        self.client.force_login(self.admin)

    def test_admin_sees_every_request_with_citizen_details(self):
        response = self.client.get(LIST_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        by_ref = {r["reference"]: r for r in response.data["results"]}
        self.assertEqual(by_ref[self.alice_request.reference]["citizen"]["full_name"], "Alice")
        self.assertEqual(by_ref[self.bob_request.reference]["citizen"]["email"], "bob@example.test")

    def test_admin_can_open_any_request(self):
        response = self.client.get(f"{LIST_URL}{self.bob_request.reference}/")
        self.assertEqual(response.status_code, 200)

    def test_admin_scope_in_analytics_is_all(self):
        self.assertEqual(self.client.get("/api/analytics/summary/").data["scope"], "all")

    def test_service_layer_can_only_be_driven_by_admins(self):
        # Belt and braces: even bypassing the view, a citizen actor is refused.
        from django.core.exceptions import PermissionDenied

        with self.assertRaises(PermissionDenied):
            services.change_status(
                service_request=self.alice_request, new_status=Status.IN_PROGRESS, actor=self.alice
            )
