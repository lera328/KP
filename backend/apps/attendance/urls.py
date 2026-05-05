from django.urls import path

from .views import (
    LessonListCreateView,
    LessonRetrieveUpdateDestroyView,
    LessonTopicListCreateView,
    add_extra_lesson_view,
    approve_makeup_view,
    conduct_lesson_view,
    create_makeup_request_view,
    mark_attendance_view,
    my_attendance_view,
    setup_group_schedule_view,
    update_makeup_slots_view,
)

urlpatterns = [
    path("topics/", LessonTopicListCreateView.as_view(), name="topics-list-create"),
    path("lessons/", LessonListCreateView.as_view(), name="lessons-list-create"),
    path("lessons/setup-group-schedule/", setup_group_schedule_view, name="lessons-setup-group-schedule"),
    path("lessons/add-extra/", add_extra_lesson_view, name="lessons-add-extra"),
    path("lessons/<int:pk>/", LessonRetrieveUpdateDestroyView.as_view(), name="lessons-detail"),
    path("lessons/<int:lesson_id>/conduct/", conduct_lesson_view, name="lessons-conduct"),
    path("lessons/makeup-slots/", update_makeup_slots_view, name="lessons-makeup-slots"),
    path("attendance/mark/", mark_attendance_view, name="attendance-mark"),
    path("attendance/my/", my_attendance_view, name="attendance-my"),
    path("makeups/request/", create_makeup_request_view, name="makeups-request"),
    path("makeups/<int:request_id>/approve/", approve_makeup_view, name="makeups-approve"),
]
