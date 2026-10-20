from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/requests/", include("apps.service_requests.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
]

handler404 = "apps.core.views.not_found"
handler500 = "apps.core.views.server_error"
