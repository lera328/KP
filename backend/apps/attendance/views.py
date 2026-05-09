from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.db.models import Q
from datetime import timedelta

from apps.users.permissions import IsAdminRole
from apps.users.models import Role

from .conflicts import describe_conflict, find_location_conflict
from .makeup_invites import accept_invite, get_invite_details
from .models import AttendanceRecord, Lesson, LessonTopic, MakeUpInvite, MakeUpRequest
from .serializers import (
    AttendanceMarkSerializer,
    ExtraLessonCreateSerializer,
    GroupScheduleSetupSerializer,
    LessonConductSerializer,
    LessonSerializer,
    LessonTopicSerializer,
    MakeUpApproveSerializer,
    MakeUpRequestCreateSerializer,
    MakeUpRequestSerializer,
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
            # Слоты отработки в общем расписании показываются только после того,
            # как админ подтвердил хотя бы одну заявку (записанного ребёнка).
            approved = MakeUpRequest.Status.APPROVED
            return (
                queryset.filter(teacher=user)
                .filter(
                    Q(is_makeup_slot=False)
                    | Q(is_makeup_slot=True, makeup_requests__status=approved)
                )
                .distinct()
            )

        is_student = user.roles.filter(code="student").exists()
        if is_student:
            # Ученик видит свои регулярные занятия + подтверждённые слоты отработки,
            # на которые он записан.
            approved = MakeUpRequest.Status.APPROVED
            return (
                queryset.filter(
                    Q(group__groupstudent__user=user)
                    | Q(
                        is_makeup_slot=True,
                        makeup_requests__student=user,
                        makeup_requests__status=approved,
                    )
                )
                .distinct()
            )

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


def _ensure_parent_role(user):
    is_parent = user.roles.filter(code=Role.Code.PARENT).exists()
    if not is_parent:
        raise PermissionDenied("Раздел доступен только родителям")


def _month_range(reference_date):
    start = reference_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


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

    absence = serializer.validated_data["absence"]
    user = request.user
    is_admin = user.is_superuser or user.roles.filter(code=Role.Code.ADMIN).exists()
    if not is_admin:
        if user.roles.filter(code=Role.Code.PARENT).exists():
            parent_profile = getattr(user, "parent_profile", None)
            allowed = parent_profile and parent_profile.students.filter(
                user_id=absence.student_id
            ).exists()
            if not allowed:
                raise PermissionDenied("Нельзя создавать отработку для чужого ученика")
        else:
            raise PermissionDenied("Запись на отработку доступна только родителю или администратору")

    request_obj = serializer.save()
    return Response({"id": request_obj.id, "status": request_obj.status}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_makeups_view(request):
    is_student = request.user.roles.filter(code=Role.Code.STUDENT).exists()
    if not is_student:
        raise PermissionDenied("Раздел доступен только ученику")

    requests = (
        MakeUpRequest.objects.filter(student=request.user)
        .select_related(
            "student",
            "approved_by",
            "absence_record__lesson__group",
            "makeup_lesson__group",
        )
        .order_by("-created_at")
    )
    serializer = MakeUpRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def suggest_makeup_slots_view(request):
    absence_record_id = request.query_params.get("absence_record_id")
    if not absence_record_id:
        return Response(
            {"detail": "absence_record_id обязателен"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    absence = (
        AttendanceRecord.objects.filter(id=absence_record_id)
        .select_related("lesson", "lesson__topic")
        .first()
    )
    if not absence or absence.status != AttendanceRecord.Status.ABSENT:
        return Response(
            {"detail": "Запись пропуска не найдена"},
            status=status.HTTP_404_NOT_FOUND,
        )

    user = request.user
    is_admin = user.is_superuser or user.roles.filter(code=Role.Code.ADMIN).exists()
    is_teacher = user.roles.filter(code=Role.Code.TEACHER).exists()
    if not (is_admin or is_teacher):
        if absence.student_id == user.id:
            pass
        elif user.roles.filter(code=Role.Code.PARENT).exists():
            parent_profile = getattr(user, "parent_profile", None)
            allowed = parent_profile and parent_profile.students.filter(
                user_id=absence.student_id
            ).exists()
            if not allowed:
                raise PermissionDenied("Нет доступа к этому ученику")
        else:
            raise PermissionDenied("Нет доступа к подбору отработки")

    # Правило: запись на отработку доступна, только если пропущенный урок входит
    # в три последних прошедших занятия ученика.
    last_lesson_ids = list(
        AttendanceRecord.objects.filter(
            student_id=absence.student_id,
            lesson__starts_at__lte=timezone.now(),
        )
        .order_by("-lesson__starts_at")
        .values_list("lesson_id", flat=True)[:3]
    )
    if absence.lesson_id not in last_lesson_ids:
        return Response(
            {
                "absence_record_id": absence.id,
                "slots": [],
                "detail": "Запись на отработку доступна только для трёх последних занятий ученика.",
            },
            status=status.HTTP_200_OK,
        )

    used_lesson_ids = set(
        MakeUpRequest.objects.filter(student_id=absence.student_id).values_list(
            "makeup_lesson_id", flat=True
        )
    )

    now = timezone.now()
    active_statuses = [
        MakeUpRequest.Status.REQUESTED,
        MakeUpRequest.Status.COMPLETED,
        MakeUpRequest.Status.APPROVED,
    ]
    # Отработка может проходить на любой локации — фильтр по локации/теме не нужен.
    # Возвращаем все свободные будущие слоты с ещё незаполненной вместимостью.
    slots = (
        Lesson.objects.filter(
            is_makeup_slot=True,
            starts_at__gte=now,
        )
        .exclude(id__in=used_lesson_ids)
        .select_related("group", "teacher", "location")
        .order_by("starts_at")
    )

    payload = []
    for slot in slots:
        booked = MakeUpRequest.objects.filter(
            makeup_lesson=slot,
            status__in=active_statuses,
        ).count()
        if booked >= (slot.makeup_capacity or 0):
            continue  # слот уже заполнен
        payload.append(
            {
                "lesson_id": slot.id,
                "starts_at": slot.starts_at,
                "group_id": slot.group_id,
                "group_name": slot.group.name if slot.group_id else "",
                "teacher_name": (slot.teacher.get_full_name().strip() or slot.teacher.username),
                "location_id": slot.location_id,
                "location_name": slot.location.name if slot.location_id else "",
                "capacity": slot.makeup_capacity,
                "booked": booked,
            }
        )
    return Response({"absence_record_id": absence.id, "slots": payload})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parent_makeups_view(request):
    _ensure_parent_role(request.user)

    parent_profile = getattr(request.user, "parent_profile", None)
    if not parent_profile:
        return Response([])

    student_ids = list(parent_profile.students.values_list("user_id", flat=True))
    requests = (
        MakeUpRequest.objects.filter(student_id__in=student_ids)
        .select_related(
            "student",
            "approved_by",
            "absence_record__lesson__group",
            "makeup_lesson__group",
        )
        .order_by("-created_at")
    )
    serializer = MakeUpRequestSerializer(requests, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_makeups_view(request):
    requests = (
        MakeUpRequest.objects.select_related(
            "student",
            "approved_by",
            "absence_record__lesson__group",
            "makeup_lesson__group",
        )
        .order_by("-created_at")
    )
    serializer = MakeUpRequestSerializer(requests, many=True)
    return Response(serializer.data)


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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def teacher_makeup_slots_view(request):
    """FR (sprint7): преподаватель управляет своими слотами отработок (без привязки к группе).

    GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — список слотов учителя за период.
    POST {create:[{course_id,location_id,starts_at,capacity}], delete:[lesson_id]} — batch.
    """
    user = request.user
    is_admin = user.is_superuser or user.roles.filter(code=Role.Code.ADMIN).exists()
    is_teacher = user.roles.filter(code=Role.Code.TEACHER).exists()
    if not (is_admin or is_teacher):
        raise PermissionDenied("Только преподаватель или администратор")

    if request.method == "GET":
        qs = Lesson.objects.filter(is_makeup_slot=True)
        if not is_admin:
            qs = qs.filter(teacher=user)
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        if date_from:
            qs = qs.filter(starts_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(starts_at__date__lte=date_to)
        qs = qs.select_related("location", "teacher").order_by("starts_at")
        data = []
        for lesson in qs:
            booked = MakeUpRequest.objects.filter(
                makeup_lesson=lesson,
                status__in=[MakeUpRequest.Status.REQUESTED, MakeUpRequest.Status.COMPLETED, MakeUpRequest.Status.APPROVED],
            ).count()
            data.append({
                "id": lesson.id,
                "starts_at": lesson.starts_at,
                "location_id": lesson.location_id,
                "location_name": lesson.location.name if lesson.location else None,
                "teacher_id": lesson.teacher_id,
                "teacher_name": lesson.teacher.get_full_name().strip() or lesson.teacher.username,
                "capacity": lesson.makeup_capacity,
                "booked": booked,
            })
        return Response(data)

    # POST batch — учитель/админ создаёт и удаляет слоты отработок
    creates = request.data.get("create", []) or []
    deletes = request.data.get("delete", []) or []

    from apps.courses.models import Location as LocationModel
    from django.utils.dateparse import parse_datetime

    created_ids = []
    with transaction.atomic():
        for item in creates:
            try:
                location_id = int(item["location_id"])
                starts_at_raw = item["starts_at"]
                capacity = int(item.get("capacity", 2))
                starts_at = parse_datetime(starts_at_raw) if isinstance(starts_at_raw, str) else starts_at_raw
                if starts_at is None:
                    raise ValueError("bad datetime")
                if timezone.is_naive(starts_at):
                    starts_at = timezone.make_aware(starts_at, timezone.get_current_timezone())
            except (KeyError, TypeError, ValueError):
                return Response({"detail": "Некорректный элемент в create"}, status=status.HTTP_400_BAD_REQUEST)

            location = LocationModel.objects.filter(id=location_id, is_active=True).first()
            if not location:
                return Response({"detail": "Локация не найдена"}, status=status.HTTP_400_BAD_REQUEST)
            if capacity < 1 or capacity > 2:
                return Response({"detail": "Capacity допустим в диапазоне 1..2"}, status=status.HTTP_400_BAD_REQUEST)

            conflict = find_location_conflict(starts_at, location.id, is_makeup_slot=True)
            if conflict is not None:
                transaction.set_rollback(True)
                return Response(
                    {"detail": f"Конфликт по локации: уже занято — {describe_conflict(conflict)}"},
                    status=status.HTTP_409_CONFLICT,
                )

            lesson = Lesson.objects.create(
                group=None,
                topic=None,
                teacher=user,
                starts_at=starts_at,
                is_makeup_slot=True,
                location=location,
                makeup_capacity=capacity,
            )
            created_ids.append(lesson.id)

        if deletes:
            del_qs = Lesson.objects.filter(id__in=deletes, is_makeup_slot=True)
            if not is_admin:
                del_qs = del_qs.filter(teacher=user)
            blocked = list(
                del_qs.filter(makeup_requests__isnull=False).values_list("id", flat=True).distinct()
            )
            if blocked:
                return Response(
                    {"detail": f"Нельзя удалить слоты с бронированиями: {blocked}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            del_qs.delete()

    return Response({"created_ids": created_ids, "deleted": deletes}, status=status.HTTP_200_OK)


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

    if not group.location_id:
        return Response(
            {"detail": "У группы не указана локация — задайте её в карточке группы."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    topic = _get_or_create_placeholder_topic(group)

    with transaction.atomic():
        group.weekly_lesson_weekday = starts_at_local.weekday()
        group.weekly_lesson_time = starts_at_local.time().replace(second=0, microsecond=0)
        group.save(update_fields=["weekly_lesson_weekday", "weekly_lesson_time"])

        created_ids = []
        point = starts_at_local
        end_date = starts_at_local + timedelta(days=365)
        while point <= end_date:
            existing = Lesson.objects.filter(group=group, starts_at=point).first()
            if existing is None:
                conflict = find_location_conflict(point, group.location_id)
                if conflict is not None:
                    transaction.set_rollback(True)
                    return Response(
                        {"detail": f"Конфликт по локации: уже занято — {describe_conflict(conflict)}"},
                        status=status.HTTP_409_CONFLICT,
                    )

            lesson, created = Lesson.objects.get_or_create(
                group=group,
                starts_at=point,
                defaults={
                    "teacher": teacher,
                    "topic": topic,
                    "location": group.location,
                    "is_extra": False,
                },
            )
            if not created:
                update_fields = []
                if lesson.is_extra:
                    lesson.is_extra = False
                    update_fields.append("is_extra")
                if not lesson.location_id and group.location_id:
                    lesson.location = group.location
                    update_fields.append("location")
                if update_fields:
                    lesson.save(update_fields=update_fields)
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

    if not group.location_id:
        return Response(
            {"detail": "У группы не указана локация."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    conflict = find_location_conflict(starts_at, group.location_id)
    if conflict is not None:
        return Response(
            {"detail": f"Конфликт по локации: уже занято — {describe_conflict(conflict)}"},
            status=status.HTTP_409_CONFLICT,
        )

    topic = _get_or_create_placeholder_topic(group)

    lesson = Lesson.objects.create(
        group=group,
        teacher=teacher,
        topic=topic,
        location=group.location,
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
        .select_related("lesson", "lesson__group", "lesson__topic")
        .order_by("-lesson__starts_at", "-id")
    )

    data = [
        {
            "id": record.id,
            "status": record.status,
            "charged": record.charged,
            "grade": record.grade,
            "teacher_comment": record.teacher_comment,
            "homework": record.lesson.homework,
            "lesson_starts_at": record.lesson.starts_at,
            "lesson_topic": record.lesson.conducted_topic or record.lesson.topic.title,
            "group_name": record.lesson.group.name,
            "lesson_id": record.lesson_id,
        }
        for record in records
    ]

    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_salary_view(request):
    is_teacher = request.user.roles.filter(code=Role.Code.TEACHER).exists()
    if not is_teacher:
        raise PermissionDenied("Раздел доступен только преподавателям")

    now = timezone.localtime()
    month_start, month_end = _month_range(now)

    lessons = (
        Lesson.objects.filter(
            teacher=request.user,
            starts_at__gte=month_start,
            starts_at__lt=month_end,
        )
        .filter(Q(conducted_topic__isnull=False) | Q(conducted_description__isnull=False))
        .exclude(conducted_topic="", conducted_description="")
        .order_by("starts_at", "id")
    )

    response_data = [
        {
            "id": lesson.id,
            "starts_at": lesson.starts_at,
            "group": lesson.group_id,
            "conducted_topic": lesson.conducted_topic,
        }
        for lesson in lessons
    ]

    return Response(
        {
            "rate_per_lesson": int(getattr(settings, "TEACHER_RATE_PER_LESSON", 1500)),
            "lessons": response_data,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def makeup_invite_details_view(request, token):
    """FR-11: публично возвращает детали приглашения по токену (для UI подтверждения)."""
    details = get_invite_details(token)
    if details is None:
        return Response({"detail": "Приглашение не найдено"}, status=status.HTTP_404_NOT_FOUND)
    return Response(details)


@api_view(["POST"])
@permission_classes([AllowAny])
def makeup_invite_accept_view(request, token):
    """FR-11: применить токен — создать MakeUpRequest в один клик."""
    result = accept_invite(token)
    if not result.get("ok"):
        code = result.get("code", "error")
        return Response({"detail": code}, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)
