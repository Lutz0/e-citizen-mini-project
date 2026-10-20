from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Session authentication that answers anonymous requests with 401.

    DRF's stock ``SessionAuthentication`` has no ``WWW-Authenticate`` challenge,
    so unauthenticated requests get ``403`` - indistinguishable from "logged in
    but not allowed". Supplying a challenge header makes DRF return ``401``
    instead, which lets the SPA tell "please log in" apart from "forbidden".

    CSRF is still enforced for every authenticated unsafe request.
    """

    def authenticate_header(self, request):
        return "Session"
