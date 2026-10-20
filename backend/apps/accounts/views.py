from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

# DRF exempts views from Django's CSRF middleware and then only enforces CSRF
# for *authenticated* sessions. Anonymous endpoints that create a session
# (register / login) must therefore opt in explicitly to prevent login-CSRF.
anonymous_csrf_protect = method_decorator(csrf_protect, name="dispatch")


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the ``csrftoken`` cookie that the SPA echoes in ``X-CSRFToken``."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(APIView):
    """Reports who (if anyone) is signed in, and sets the CSRF cookie.

    Always answers 200 - ``{"user": null}`` for anonymous visitors - so the SPA
    can learn its sign-in state on page load without triggering a 401 error in
    the browser console. (``/me/`` is the strict variant that 401s.)
    """

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        return Response({"user": UserSerializer(user).data if user else None})


@anonymous_csrf_protect
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@anonymous_csrf_protect
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            # One generic message for unknown email, wrong password and
            # deactivated accounts, so the response never reveals which it was.
            raise ValidationError({"non_field_errors": ["Invalid email or password."]})
        login(request, user)
        return Response(UserSerializer(user).data)


@anonymous_csrf_protect
class LogoutView(APIView):
    """Ends the session. Idempotent: logging out twice is not an error."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
