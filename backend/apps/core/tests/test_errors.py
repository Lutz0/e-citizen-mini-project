from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient


@override_settings(ROOT_URLCONF="apps.core.tests.urls", DEBUG=False)
class ErrorHandlingTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient(raise_request_exception=False)

    def test_unexpected_exceptions_return_generic_json_without_internals(self):
        response = self.client.get("/api/boom/")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response["Content-Type"], "application/json")
        body = response.content.decode()
        self.assertIn("server_error", body)
        for leaked in ("hunter2", "RuntimeError", "settings.py", "Traceback"):
            self.assertNotIn(leaked, body)

    def test_unknown_urls_return_json_404(self):
        response = self.client.get("/api/does-not-exist/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "not_found")

    def test_wrong_http_method_returns_json_405(self):
        response = self.client.get("/api/auth/login/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json()["code"], "method_not_allowed")

    def test_malformed_json_body_is_a_clean_400(self):
        response = self.client.post("/api/auth/login/", data="{not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())
