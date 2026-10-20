from django.contrib import admin

from .models import Comment, ServiceRequest, StatusChange


class ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class StatusChangeInline(ReadOnlyInline):
    model = StatusChange
    fields = ("created_at", "from_status", "to_status", "changed_by", "note")
    readonly_fields = fields


class CommentInline(ReadOnlyInline):
    model = Comment
    fields = ("created_at", "author", "body")
    readonly_fields = fields


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    """Operator view. Status changes must go through the API so they are audited."""

    list_display = ("reference", "category", "status", "severity", "citizen", "created_at")
    list_filter = ("status", "category", "severity")
    search_fields = ("reference", "location", "description", "citizen__email", "citizen__full_name")
    readonly_fields = (
        "reference", "citizen", "category", "location", "description", "severity", "image",
        "status", "created_at", "updated_at", "in_progress_at", "resolved_at",
    )
    inlines = [StatusChangeInline, CommentInline]

    def has_add_permission(self, request):
        return False


@admin.register(StatusChange)
class StatusChangeAdmin(admin.ModelAdmin):
    """The audit trail is append-only: no add/change/delete from the admin."""

    list_display = ("created_at", "service_request", "from_status", "to_status", "changed_by")
    list_filter = ("to_status",)
    search_fields = ("service_request__reference", "changed_by__email")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
