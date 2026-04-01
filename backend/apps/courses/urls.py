from django.urls import path

from .views import CourseListCreateView, GroupListCreateView

urlpatterns = [
    path("courses/", CourseListCreateView.as_view(), name="courses-list-create"),
    path("groups/", GroupListCreateView.as_view(), name="groups-list-create"),
]
