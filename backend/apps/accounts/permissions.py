from rest_framework.permissions import BasePermission

from .models import Role


def _has_role(user, role):
    return bool(user and user.is_authenticated and user.is_active and user.role == role)


class IsAdministrator(BasePermission):
    """Only authorised administrators (``role == admin``)."""

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        return _has_role(request.user, Role.ADMIN)


class IsCitizen(BasePermission):
    """Only citizen accounts."""

    message = "Only citizens can submit service requests."

    def has_permission(self, request, view):
        return _has_role(request.user, Role.CITIZEN)
