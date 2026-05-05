from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from apps.users.permissions import IsAdminRole

from .models import AttendanceRecord, Lesson, LessonTopic, MakeUpRequest
from .serializers import (
    AttendanceMarkSerializer,
    ExtraLessonCreateSerializer,
    GroupScheduleSetupSerializer,
    LessonConductSerializer,
    LessonSerializer,
    LessonTopicSerializer,
    MakeUpApproveSerializer,
    MakeUpRequestCreateSerializer,
)


class LessonTopicListCreateView(generics.ListCreateAPIView):
    queryset = LessonTopic.objects.all().order_by("id")
    serializer_class = LessonTopicSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class LessonListCreateView(generics.ListCreateAPIView):
    queryset = Lesson.objects.all().order_by("id")
    serializer_class = LessonSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Lesson.objects.all().order_by("starts_at", "id")
        user = self.request.user

        is_admin = user.is_superuser or user.roles.filter(code="admin").exists()
        if is_admin:
            return queryset

        is_teacher = user.roles.filter(code="teacher").exists()
        if is_teacher:
            return queryset.filter(teacher=user)

        is_student = user.roles.filter(code="student").exists()
        if is_student:
            return queryset.filter(group__groupstudent__user=user).distinct()

        return queryset.none()


class LessonRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Lesson.objects.all()
        user = self.request.user

        is_admin = user.is_superuser or user.roles.filter(code="admin").exists()
        if is_admin:
            return queryset

        is_teacher = user.roles.filter(code="teacher").exists()
        if is_teacher:
            return queryset.filter(teacher=user)

        return queryset.none()

    def update(self, request, *args, **kwargs):
        allowed_fields = {"teacher"}
        payload_fields = set(request.data.keys())

        if not payload_fields.issubset(allowed_fields):
            return Response(
                {"detail": "Можно изменять только преподавателя занятия."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(request, *args, **kwargs)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_attendance_view(request):
    serializer = AttendanceMarkSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    record = serializer.save()
    return Response({"id": record.id, "status": record.status, "charged": record.charged})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_makeup_request_view(request):
    serializer = MakeUpRequestCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    request_obj = serializer.save()
    return Response({"id": request_obj.id, "status": request_obj.status}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminRole])
def approve_makeup_view(request, request_id):
    request_obj = MakeUpRequest.objects.get(id=request_id)
    serializer = MakeUpApproveSerializer(data={})
    serializer.is_valid(raise_exception=True)
    request_obj = serializer.save(request_obj=request_obj, admin_user=request.user)
    return Response({"id": request_obj.id, "status": request_obj.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def conduct_lesson_view(request, lesson_id):
    lesson = Lesson.objects.get(id=lesson_id)

    is_admin = request.user.is_superuser or request.user.roles.filter(code="admin").exists()
    if not is_admin and lesson.teacher_id != request.user.id:
        raise PermissionDenied("Вы не можете проводить это занятие")

    serializer = LessonConductSerializer(data=request.data, context={"lesson": lesson})
    serializer.is_valid(raise_exception=True)
    result = serializer.save()
    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_makeup_slots_view(request):
    lesson_ids = request.data.get("lesson_ids", [])

    if not isinstance(lesson_ids, list):
        return Response({"detail": "lesson_ids должен быть списком"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        requested_ids = [int(lesson_id) for lesson_id in lesson_ids]
    except (TypeError, ValueError):
        return Response({"detail": "lesson_ids содержит некорректные значения"}, status=status.HTTP_400_BAD_REQUEST)

    is_admin = request.user.is_superuser or request.user.roles.filter(code="admin").exists()
    is_teacher = request.user.roles.filter(code="teacher").exists()

    if is_admin:
        allowed_queryset = Lesson.objects.all()
    elif is_teacher:
        allowed_queryset = Lesson.objects.filter(teacher=request.user)
    else:
        raise PermissionDenied("Недостаточно прав для настройки слотов отработок")

    allowed_ids = set(allowed_queryset.values_list("id", flat=True))
    invalid_ids = [lesson_id for lesson_id in requested_ids if lesson_id not in allowed_ids]
    if invalid_ids:
        raise PermissionDenied("В списке есть уроки, недоступные для текущего преподавателя")

    with transaction.atomic():
        allowed_queryset.update(is_makeup_slot=False)
        if requested_ids:
            Lesson.objects.filter(id__in=requested_ids).update(is_makeup_slot=True)

    return Response({"lesson_ids": requested_ids, "count": len(requested_ids)}, status=status.HTTP_200_OK)


def _get_or_create_placeholder_topic(group):
    topic = LessonTopic.objects.filter(course=group.course, title="Тема задаётся преподавателем").first()
    if topic:
        return topic
    return LessonTopic.objects.create(course=group.course, title="Тема задаётся преподавателем")


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def setup_group_schedule_view(request):
    serializer = GroupScheduleSetupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    group = serializer.validated_data["group"]
    teacher = serializer.validated_data["teacher"]
    starts_at_local = serializer.validated_data["starts_at_local"]

    topic = _get_or_create_placeholder_topic(group)

    with transaction.atomic():
        group.weekly_lesson_weekday = starts_at_local.weekday()
        group.weekly_lesson_time = starts_at_local.time().replace(second=0, microsecond=0)
        group.save(update_fields=["weekly_lesson_weekday", "weekly_lesson_time"])

        created_ids = []
        point = starts_at_local
        end_date = starts_at_local + timedelta(days=365)
        while point <= end_date:
            lesson, created = Lesson.objects.get_or_create(
                group=group,
                starts_at=point,
                defaults={
                    "teacher": teacher,
                    "topic": topic,
                    "is_extra": False,
                },
            )
            if not created:
                if lesson.is_extra:
                    lesson.is_extra = False
                    lesson.save(update_fields=["is_extra"])
            else:
                created_ids.append(lesson.id)

            point = point + timedelta(days=7)

    return Response(
        {
            "group_id": group.id,
            "weekday": group.weekly_lesson_weekday,
            "time": str(group.weekly_lesson_time),
            "created_count": len(created_ids),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def add_extra_lesson_view(request):
    serializer = ExtraLessonCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    group = serializer.validated_data["group"]
    teacher = serializer.validated_data["teacher"]
    starts_at = serializer.validated_data["starts_at"]

    topic = _get_or_create_placeholder_topic(group)

    lesson = Lesson.objects.create(
        group=group,
        teacher=teacher,
        topic=topic,
        starts_at=starts_at,
        is_extra=True,
    )

    return Response({"id": lesson.id}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attendance_view(request):
    is_student = request.user.roles.filter(code="student").exists()
    if not is_student:
        raise PermissionDenied("Раздел доступен только ученику")

    records = (
        AttendanceRecord.objects.filter(student=request.user)
        .select_related("lesson", "lesson__group")
        .order_by("-lesson__starts_at", "-id")
    )

    data = [
        {
            "id": record.id,
            "status": record.status,
            "charged": record.charged,
            "lesson_starts_at": record.lesson.starts_at,
            "group_name": record.lesson.group.name,
            "lesson_id": record.lesson_id,
        }
        for record in records
    ]

    return Response(data)
