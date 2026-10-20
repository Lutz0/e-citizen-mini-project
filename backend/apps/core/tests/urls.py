"""URLconf used only by test_errors: adds a view that always crashes."""
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from config.urls import urlpatterns as project_urlpatterns
from django.urls import path


class ExplodingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        raise RuntimeError("secret internal detail: db password=hunter2 at /srv/app/settings.py")


urlpatterns = project_urlpatterns + [path("api/boom/", ExplodingView.as_view())]
handler404 = "apps.core.views.not_found"
handler500 = "apps.core.views.server_error"
