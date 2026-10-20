from rest_framework.routers import SimpleRouter

from .views import ServiceRequestViewSet

router = SimpleRouter()
router.register("", ServiceRequestViewSet, basename="service-request")

urlpatterns = router.urls
