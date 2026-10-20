import mimetypes

from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response

from apps.accounts.permissions import IsAdministrator, IsCitizen

from . import selectors, services
from .filters import ServiceRequestFilter
from .serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    ServiceRequestCreateSerializer,
    ServiceRequestDetailSerializer,
    ServiceRequestListSerializer,
    StatusChangeInputSerializer,
)


# Room for the form fields and multipart framing around the file.
MULTIPART_OVERHEAD_BYTES = 256 * 1024


class PayloadTooLarge(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_code = "payload_too_large"
    default_detail = "The upload is too large."


class PassthroughRenderer(BaseRenderer):
    """Lets an endpoint return raw bytes (an image) instead of JSON."""

    media_type = "*/*"
    format = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ServiceRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Service requests.

    * Citizens: create, and list/read **their own** requests.
    * Administrators: list/read **all** requests and change their status.

    Requests are addressed by their public reference number (``SR-2026-K7M3Q9``).
    """

    lookup_field = "reference"
    lookup_value_regex = r"[A-Za-z0-9\-]+"
    filterset_class = ServiceRequestFilter
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # -- wiring ------------------------------------------------------------
    def get_permissions(self):
        if self.action == "create":
            classes = [IsAuthenticated, IsCitizen]
        elif self.action == "change_status":
            classes = [IsAuthenticated, IsAdministrator]
        else:
            classes = [IsAuthenticated]
        return [permission() for permission in classes]

    def get_queryset(self):
        queryset = selectors.visible_requests(self.request.user)
        if self.action != "list":
            queryset = selectors.with_detail_relations(queryset)
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return ServiceRequestCreateSerializer
        if self.action == "list":
            return ServiceRequestListSerializer
        return ServiceRequestDetailSerializer

    def get_object(self):
        # Query-string filters are for list views only; don't apply them to a lookup.
        reference = self.kwargs[self.lookup_field].upper()
        obj = get_object_or_404(self.get_queryset(), reference=reference)
        self.check_object_permissions(self.request, obj)
        return obj

    # -- endpoints ---------------------------------------------------------
    def create(self, request, *args, **kwargs):
        # Refuse an obviously oversized body from its declared length, before it is read and parsed.
        # (The image validator still enforces the exact limit on what does get through.)
        declared = request.META.get("CONTENT_LENGTH", "")
        if declared.isdigit() and int(declared) > settings.IMAGE_MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES:
            raise PayloadTooLarge(
                f"The upload is too large. Images can be at most {settings.IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024):g} MB."
            )
        serializer = ServiceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service_request = services.create_request(citizen=request.user, **serializer.validated_data)
        return self._detail_response(request, service_request, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, reference=None):
        """Administrators only: advance a request along Pending -> In Progress -> Resolved."""
        service_request = self.get_object()
        serializer = StatusChangeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.change_status(
                service_request=service_request,
                new_status=serializer.validated_data["status"],
                actor=request.user,
                note=serializer.validated_data["note"],
            )
        except services.InvalidStatusTransition as exc:
            raise ValidationError({"status": [str(exc)]})
        return self._detail_response(request, self.get_object())

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, reference=None):
        service_request = self.get_object()
        if request.method == "GET":
            serializer = CommentSerializer(
                service_request.comments.all(), many=True, context=self.get_serializer_context()
            )
            return Response(serializer.data)

        input_serializer = CommentCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        comment = services.add_comment(
            service_request=service_request,
            author=request.user,
            body=input_serializer.validated_data["body"],
        )
        return Response(
            CommentSerializer(comment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="image", renderer_classes=[PassthroughRenderer])
    def image(self, request, reference=None):
        """Streams the uploaded photo - only to the owner or an administrator."""
        service_request = self.get_object()
        if not service_request.image:
            raise NotFound("This request has no image.")
        try:
            file = service_request.image.open("rb")
        except FileNotFoundError:
            raise NotFound("The image file is no longer available.")

        content_type = mimetypes.guess_type(service_request.image.name)[0] or "application/octet-stream"
        response = FileResponse(file, content_type=content_type)
        response["Cache-Control"] = "private, max-age=3600"
        response["Content-Disposition"] = "inline"
        return response

    # -- helpers -----------------------------------------------------------
    def _detail_response(self, request, service_request, http_status=status.HTTP_200_OK):
        fresh = selectors.with_detail_relations(selectors.visible_requests(request.user)).get(
            pk=service_request.pk
        )
        data = ServiceRequestDetailSerializer(fresh, context=self.get_serializer_context()).data
        return Response(data, status=http_status)
