"""Fallback error views: the API always answers in JSON, never with an HTML error page."""
from django.http import JsonResponse


def not_found(request, exception=None):
    return JsonResponse({"detail": "Not found.", "code": "not_found"}, status=404)


def server_error(request):
    return JsonResponse(
        {"detail": "Something went wrong on our side. Please try again in a moment.", "code": "server_error"},
        status=500,
    )
