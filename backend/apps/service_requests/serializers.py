from rest_framework import serializers

from .domain import Category, Severity, Status, allowed_next_statuses
from .models import Comment, ServiceRequest, StatusChange
from .validators import validate_and_sanitize_image

SERVICE_TEAM_LABEL = "Service team"


def _display_actor(actor, viewer):
    """Name to show for ``actor`` as seen by ``viewer``.

    Administrators see real names (accountability). Citizens see their own name
    but only a generic "Service team" label for staff, so staff identities are
    not exposed to the public.
    """
    if viewer is not None and (viewer.is_administrator or viewer.pk == actor.pk):
        return actor.full_name
    return SERVICE_TEAM_LABEL if actor.is_administrator else actor.full_name


class CitizenSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    phone_number = serializers.CharField(read_only=True)


class StatusChangeSerializer(serializers.ModelSerializer):
    from_status_label = serializers.SerializerMethodField()
    to_status_label = serializers.CharField(source="get_to_status_display", read_only=True)
    changed_by_name = serializers.SerializerMethodField()
    changed_by_role = serializers.CharField(source="changed_by.role", read_only=True)

    class Meta:
        model = StatusChange
        fields = (
            "id",
            "from_status",
            "from_status_label",
            "to_status",
            "to_status_label",
            "changed_by_name",
            "changed_by_role",
            "note",
            "created_at",
        )
        read_only_fields = fields

    def get_from_status_label(self, obj):
        return obj.get_from_status_display() if obj.from_status else ""

    def get_changed_by_name(self, obj):
        return _display_actor(obj.changed_by, self.context["request"].user)


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.CharField(source="author.role", read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "author_name", "author_role", "body", "created_at")
        read_only_fields = fields

    def get_author_name(self, obj):
        return _display_actor(obj.author, self.context["request"].user)


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(
        max_length=1000,
        trim_whitespace=True,
        error_messages={
            "blank": "Please write a message.",
            "required": "Please write a message.",
            "max_length": "Messages can be at most 1000 characters.",
        },
    )


class ServiceRequestListSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_display", read_only=True)
    has_image = serializers.SerializerMethodField()
    citizen = CitizenSerializer(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = (
            "reference",
            "category",
            "category_label",
            "location",
            "description",
            "severity",
            "severity_label",
            "status",
            "status_label",
            "has_image",
            "citizen",
            "created_at",
            "updated_at",
            "in_progress_at",
            "resolved_at",
        )
        read_only_fields = fields

    def get_has_image(self, obj):
        return bool(obj.image)


class ServiceRequestDetailSerializer(ServiceRequestListSerializer):
    status_changes = StatusChangeSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    allowed_next_statuses = serializers.SerializerMethodField()

    class Meta(ServiceRequestListSerializer.Meta):
        fields = ServiceRequestListSerializer.Meta.fields + (
            "status_changes",
            "comments",
            "allowed_next_statuses",
        )
        read_only_fields = fields

    def get_allowed_next_statuses(self, obj):
        user = self.context["request"].user
        if not user.is_administrator:
            return []
        return [{"value": s.value, "label": s.label} for s in allowed_next_statuses(obj.status)]


class ServiceRequestCreateSerializer(serializers.Serializer):
    """Validates a new request. Persistence happens in ``services.create_request``."""

    category = serializers.ChoiceField(
        choices=Category.choices,
        error_messages={
            "invalid_choice": "Select a category from the list.",
            "required": "Select a category.",
            "blank": "Select a category.",
        },
    )
    location = serializers.CharField(
        min_length=3,
        max_length=255,
        trim_whitespace=True,
        error_messages={
            "blank": "Tell us where the problem is - an address, area or landmark.",
            "required": "Tell us where the problem is - an address, area or landmark.",
            "min_length": "Please give a little more detail about the location.",
            "max_length": "The location can be at most 255 characters.",
        },
    )
    description = serializers.CharField(
        min_length=10,
        max_length=2000,
        trim_whitespace=True,
        error_messages={
            "blank": "Please describe the problem.",
            "required": "Please describe the problem.",
            "min_length": "Please describe the problem in at least 10 characters.",
            "max_length": "The description can be at most 2000 characters.",
        },
    )
    severity = serializers.ChoiceField(
        choices=Severity.choices,
        required=False,
        default=Severity.MEDIUM,
        error_messages={"invalid_choice": "Select a severity from the list."},
    )
    image = serializers.FileField(required=False, allow_null=True, allow_empty_file=True)

    def validate_image(self, value):
        if value is None:
            return None
        return validate_and_sanitize_image(value)


class StatusChangeInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=Status.choices,
        error_messages={
            "invalid_choice": "Select a valid status.",
            "required": "Select the new status.",
        },
    )
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        trim_whitespace=True,
        default="",
        error_messages={"max_length": "The note can be at most 500 characters."},
    )
