from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    create_user_view,
    logout_view,
    parent_attendance_view,
    parent_billing_view,
    parent_children_view,
    profile_view,
    session_login_view,
    student_projects_view,
    update_user_view,
)

urlpatterns = [
    path("session-login/", session_login_view, name="session-login"),
    path("logout/", logout_view, name="logout"),
    path("profile/", profile_view, name="profile"),
    path("users/", create_user_view, name="create-user"),
    path("users/<int:user_id>/", update_user_view, name="update-user"),
    path("parent/children/", parent_children_view, name="parent-children"),
    path("parent/attendance/", parent_attendance_view, name="parent-attendance"),
    path("parent/billing/", parent_billing_view, name="parent-billing"),
    path("student/projects/", student_projects_view, name="student-projects"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
