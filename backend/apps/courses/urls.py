from django.urls import path

from .views import (
    CourseListCreateView,
    CourseRetrieveUpdateDestroyView,
    GroupListCreateView,
    GroupRetrieveUpdateDestroyView,
    LocationListView,
)

urlpatterns = [
    path("courses/", CourseListCreateView.as_view(), name="courses-list-create"),
    path("courses/<int:pk>/", CourseRetrieveUpdateDestroyView.as_view(), name="courses-detail"),
    path("groups/", GroupListCreateView.as_view(), name="groups-list-create"),
    path("groups/<int:pk>/", GroupRetrieveUpdateDestroyView.as_view(), name="groups-detail"),
    path("locations/", LocationListView.as_view(), name="locations-list"),
]
