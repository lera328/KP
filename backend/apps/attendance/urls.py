from django.urls import path

from .views import (
    LessonListCreateView,
    LessonTopicListCreateView,
    approve_makeup_view,
    create_makeup_request_view,
    mark_attendance_view,
)

urlpatterns = [
    path("topics/", LessonTopicListCreateView.as_view(), name="topics-list-create"),
    path("lessons/", LessonListCreateView.as_view(), name="lessons-list-create"),
    path("attendance/mark/", mark_attendance_view, name="attendance-mark"),
    path("makeups/request/", create_makeup_request_view, name="makeups-request"),
    path("makeups/<int:request_id>/approve/", approve_makeup_view, name="makeups-approve"),
]
