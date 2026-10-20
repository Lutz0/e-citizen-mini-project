from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.service_requests.selectors import visible_requests

from .services import build_summary


class SummaryQuerySerializer(serializers.Serializer):
    days = serializers.IntegerField(
        required=False,
        default=30,
        min_value=7,
        max_value=90,
        error_messages={
            "invalid": "days must be a whole number between 7 and 90.",
            "min_value": "days must be between 7 and 90.",
            "max_value": "days must be between 7 and 90.",
        },
    )


class SummaryView(APIView):
    """Request statistics.

    Administrators get figures for every request; citizens get figures for
    their own requests only (the scope is reported in ``scope``).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = SummaryQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)

        summary = build_summary(visible_requests(request.user), days=query.validated_data["days"])
        summary["scope"] = "all" if request.user.is_administrator else "mine"
        return Response(summary)
