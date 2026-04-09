from django.contrib import admin
from django.urls import include, path

from apps.core.views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.courses.urls")),
    path("api/", include("apps.attendance.urls")),
    path("api/finance/", include("apps.finance.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
]
