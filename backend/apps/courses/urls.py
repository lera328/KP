from django.urls import path

from .views import (
    CourseListCreateView,
    CourseRetrieveUpdateDestroyView,
    GroupListCreateView,
    GroupRetrieveUpdateDestroyView,
    LocationListCreateView,
    LocationRetrieveUpdateDestroyView,
    group_comment_delete_view,
    group_comments_view,
)

urlpatterns = [
    path("courses/", CourseListCreateView.as_view(), name="courses-list-create"),
    path("courses/<int:pk>/", CourseRetrieveUpdateDestroyView.as_view(), name="courses-detail"),
    path("groups/", GroupListCreateView.as_view(), name="groups-list-create"),
    path("groups/<int:pk>/", GroupRetrieveUpdateDestroyView.as_view(), name="groups-detail"),
    path("groups/<int:group_id>/comments/", group_comments_view, name="group-comments"),
    path(
        "groups/<int:group_id>/comments/<int:comment_id>/",
        group_comment_delete_view,
        name="group-comment-delete",
    ),
    path("locations/", LocationListCreateView.as_view(), name="locations-list-create"),
    path("locations/<int:pk>/", LocationRetrieveUpdateDestroyView.as_view(), name="locations-detail"),
]
