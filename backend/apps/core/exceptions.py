"""Uniform JSON error contract for the whole API.

Every error response has the shape::

    {"detail": "<human readable summary>",
     "code":   "<machine readable code>",
     "errors": {"<field>": ["<message>", ...]}}        # validation errors only

Unexpected exceptions are logged in full on the server but the client only
ever receives a generic message, so stack traces and internals never leak.
"""
import logging

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

GENERIC_VALIDATION_MESSAGE = "Please correct the highlighted fields and try again."
SERVER_ERROR_MESSAGE = "Something went wrong on our side. Please try again in a moment."

_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def _first_message(value):
    """Return the first human-readable string from DRF's nested error data."""
    if isinstance(value, dict):
        for item in value.values():
            message = _first_message(item)
            if message:
                return message
    elif isinstance(value, (list, tuple)):
        for item in value:
            message = _first_message(item)
            if message:
                return message
    elif value:
        return str(value)
    return ""


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    if response is None:
        view = context.get("view")
        logger.error(
            "Unhandled exception in %s",
            view.__class__.__name__ if view else "unknown view",
            exc_info=exc,
        )
        return Response(
            {"detail": SERVER_ERROR_MESSAGE, "code": "server_error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data

    if isinstance(exc, ValidationError):
        errors = data if isinstance(data, dict) else {"non_field_errors": data}
        non_field = errors.get("non_field_errors")
        response.data = {
            "detail": _first_message(non_field) if non_field else GENERIC_VALIDATION_MESSAGE,
            "code": "validation_error",
            "errors": errors,
        }
        return response

    detail = data.get("detail") if isinstance(data, dict) else data
    response.data = {
        "detail": _first_message(detail) or "Request could not be completed.",
        "code": _STATUS_CODES.get(response.status_code, getattr(exc, "default_code", "error")),
    }
    return response
