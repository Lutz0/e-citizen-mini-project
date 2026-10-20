from unittest import mock

from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import Role, User
from apps.core.testing import PASSWORD, BaseAPITestCase, make_admin, make_citizen

REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/auth/me/"
SESSION_URL = "/api/auth/session/"


def registration_payload(**overrides):
    payload = {
        "full_name": "Wanjiru Kamau",
        "email": "wanjiru@example.test",
        "phone_number": "0712 345 678",
        "password": PASSWORD,
        "password_confirm": PASSWORD,
    }
    payload.update(overrides)
    return payload


class RegistrationTests(BaseAPITestCase):
    def test_citizen_can_register(self):
        response = self.client.post(REGISTER_URL, registration_payload())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["email"], "wanjiru@example.test")
        self.assertEqual(response.data["role"], Role.CITIZEN)
        self.assertNotIn("password", response.data)

        user = User.objects.get(email="wanjiru@example.test")
        self.assertEqual(user.role, Role.CITIZEN)
        self.assertNotEqual(user.password, PASSWORD, "password must be stored hashed")
        self.assertTrue(user.check_password(PASSWORD))

    def test_registering_signs_the_user_in(self):
        self.client.post(REGISTER_URL, registration_payload())
        me = self.client.get(ME_URL)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "wanjiru@example.test")

    def test_cannot_register_as_administrator(self):
        response = self.client.post(
            REGISTER_URL,
            registration_payload(role="admin", is_staff=True, is_superuser=True),
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="wanjiru@example.test")
        self.assertEqual(user.role, Role.CITIZEN)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_email_is_normalised_to_lowercase(self):
        self.client.post(REGISTER_URL, registration_payload(email="  Wanjiru@Example.TEST "))
        self.assertTrue(User.objects.filter(email="wanjiru@example.test").exists())

    def test_required_fields_are_reported_individually(self):
        response = self.client.post(REGISTER_URL, {})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        for field in ("full_name", "email", "password", "password_confirm"):
            self.assertIn(field, response.data["errors"], field)

    def test_invalid_email_is_rejected(self):
        response = self.client.post(REGISTER_URL, registration_payload(email="not-an-email"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["errors"]["email"], ["Enter a valid email address."])

    def test_duplicate_email_is_rejected_case_insensitively(self):
        make_citizen(email="wanjiru@example.test")
        response = self.client.post(REGISTER_URL, registration_payload(email="WANJIRU@example.test"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.data["errors"]["email"][0])
        self.assertEqual(User.objects.count(), 1)

    def test_mismatched_passwords_are_rejected(self):
        response = self.client.post(REGISTER_URL, registration_payload(password_confirm="Different-Pass-1!"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["errors"]["password_confirm"], ["The two passwords do not match."])

    def test_weak_passwords_are_rejected(self):
        for weak in ("short1!", "12345678", "password", "wanjiru@example.test"):
            with self.subTest(password=weak):
                response = self.client.post(
                    REGISTER_URL, registration_payload(password=weak, password_confirm=weak)
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("password", response.data["errors"])
        self.assertEqual(User.objects.count(), 0)

    def test_invalid_phone_number_is_rejected(self):
        response = self.client.post(REGISTER_URL, registration_payload(phone_number="abc"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone_number", response.data["errors"])

    def test_phone_number_is_optional(self):
        response = self.client.post(REGISTER_URL, registration_payload(phone_number=""))
        self.assertEqual(response.status_code, 201)


class LoginLogoutTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.citizen = make_citizen(email="citizen@example.test")

    def test_login_with_valid_credentials(self):
        response = self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "citizen@example.test")
        self.assertEqual(self.client.get(ME_URL).status_code, 200)

    def test_login_is_case_insensitive_on_email(self):
        response = self.client.post(LOGIN_URL, {"email": "CITIZEN@Example.Test", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)

    def test_wrong_password_and_unknown_email_give_the_same_message(self):
        wrong_password = self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": "nope-nope-1"})
        unknown_email = self.client.post(LOGIN_URL, {"email": "ghost@example.test", "password": PASSWORD})

        for response in (wrong_password, unknown_email):
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["detail"], "Invalid email or password.")
        self.assertEqual(wrong_password.data, unknown_email.data, "responses must not reveal which was wrong")
        self.assertEqual(self.client.get(ME_URL).status_code, 401)

    def test_deactivated_account_cannot_log_in(self):
        self.citizen.is_active = False
        self.citizen.save()
        response = self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Invalid email or password.")

    def test_login_requires_both_fields(self):
        response = self.client.post(LOGIN_URL, {})
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data["errors"])
        self.assertIn("password", response.data["errors"])

    def test_logout_ends_the_session(self):
        self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        self.assertEqual(self.client.get(ME_URL).status_code, 200)

        response = self.client.post(LOGOUT_URL)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(ME_URL).status_code, 401)

    def test_logout_when_not_signed_in_is_harmless(self):
        self.assertEqual(self.client.post(LOGOUT_URL).status_code, 204)

    def test_me_requires_authentication(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "not_authenticated")

    def test_me_returns_role_for_administrators(self):
        make_admin()
        self.client.post(LOGIN_URL, {"email": "admin@example.test", "password": PASSWORD})
        self.assertEqual(self.client.get(ME_URL).data["role"], Role.ADMIN)


class SessionProbeTests(BaseAPITestCase):
    """The SPA's page-load check: never 401, tells anonymous from signed-in, sets the CSRF cookie."""

    def test_anonymous_visitor_gets_200_with_null_user_and_a_csrf_cookie(self):
        response = self.client.get(SESSION_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"user": None})
        self.assertIn("csrftoken", response.cookies)

    def test_signed_in_user_is_returned(self):
        make_citizen(email="citizen@example.test")
        self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        response = self.client.get(SESSION_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["email"], "citizen@example.test")
        self.assertNotIn("password", response.data["user"])

    def test_session_ends_after_logout(self):
        make_citizen(email="citizen@example.test")
        self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        self.client.post(LOGOUT_URL)
        self.assertEqual(self.client.get(SESSION_URL).data, {"user": None})


class CsrfProtectionTests(BaseAPITestCase):
    """The SPA authenticates with a session cookie, so CSRF must be enforced."""

    def setUp(self):
        super().setUp()
        self.citizen = make_citizen(email="citizen@example.test")
        self.client = APIClient(enforce_csrf_checks=True)

    def _csrf_token(self):
        self.client.get("/api/auth/csrf/")
        return self.client.cookies["csrftoken"].value

    def test_login_without_csrf_token_is_rejected(self):
        response = self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD})
        self.assertEqual(response.status_code, 403)

    def test_register_without_csrf_token_is_rejected(self):
        response = self.client.post(REGISTER_URL, registration_payload())
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(email="wanjiru@example.test").exists())

    def test_login_with_csrf_token_succeeds(self):
        token = self._csrf_token()
        response = self.client.post(
            LOGIN_URL,
            {"email": "citizen@example.test", "password": PASSWORD},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)

    def test_authenticated_unsafe_request_without_token_is_rejected(self):
        token = self._csrf_token()
        self.client.post(
            LOGIN_URL, {"email": "citizen@example.test", "password": PASSWORD}, HTTP_X_CSRFTOKEN=token
        )
        # Signed in, but no CSRF header -> a forged cross-site request would look like this.
        response = self.client.post("/api/requests/", {"category": "water"})
        self.assertEqual(response.status_code, 403)


class ThrottlingTests(BaseAPITestCase):
    def test_repeated_failed_logins_are_rate_limited(self):
        make_citizen(email="citizen@example.test")
        rates = {"login": "3/min", "register": "10/hour"}
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", rates):
            statuses = [
                self.client.post(LOGIN_URL, {"email": "citizen@example.test", "password": "wrong-pass-1"}).status_code
                for _ in range(5)
            ]
        self.assertEqual(statuses, [400, 400, 400, 429, 429])

    def test_rate_limit_cannot_be_dodged_by_spoofing_x_forwarded_for(self):
        # Without a trusted proxy the header is attacker-controlled, so it must not be used as the client's identity.
        make_citizen(email="citizen@example.test")
        rates = {"login": "3/min", "register": "10/hour"}
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", rates):
            statuses = [
                self.client.post(
                    LOGIN_URL,
                    {"email": "citizen@example.test", "password": "wrong-pass-1"},
                    HTTP_X_FORWARDED_FOR=f"203.0.113.{n}",
                ).status_code
                for n in range(1, 6)
            ]
        self.assertEqual(statuses, [400, 400, 400, 429, 429])
