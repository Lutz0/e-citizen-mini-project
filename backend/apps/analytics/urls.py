from django.urls import path

from .views import SummaryView

app_name = "analytics"

urlpatterns = [
    path("summary/", SummaryView.as_view(), name="summary"),
]
