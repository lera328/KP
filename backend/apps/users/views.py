from datetime import timedelta

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.http import HttpResponse, Http404
from django.shortcuts import render

from .auth_services import (
    confirm_password_reset,
    issue_admin_reset,
    request_password_reset,
)
from .analytics import compute_dashboard_metrics, render_dashboard_csv
from .churn import compute_churn_report
from .permissions import IsAdminRole
from .models import User, Role, StudentProfile
from .models import StudentProject, StudentProjectFile, StudentProjectLike, StudentProjectImage
from .portfolio import build_portfolio_context, render_portfolio_pdf
from .serializers import UserCreateSerializer, UserProfileSerializer, UserUpdateSerializer, StudentProjectSerializer
from apps.courses.models import Group
from apps.attendance.models import AttendanceRecord
from apps.finance.models import Payment, PaymentIntent, Subscription
from apps.finance.services import process_pending_payment_intents


def _ensure_parent_role(user):
    is_parent = user.roles.filter(code=Role.Code.PARENT).exists()
    if not is_parent:
        raise PermissionDenied("Раздел доступен только родителям")


def _ensure_student_role(user):
    is_student = user.roles.filter(code=Role.Code.STUDENT).exists()
    if not is_student:
        raise PermissionDenied("Раздел доступен только ученикам")


def _project_like_stats(project, week_start):
    total_likes = StudentProjectLike.objects.filter(project=project).count()
    week_likes = StudentProjectLike.objects.filter(project=project, created_at__gte=week_start).count()
    return total_likes, week_likes


@api_view(["POST"])
@permission_classes([AllowAny])
def session_login_view(request):
    login_value = request.data.get("username") or request.data.get("email")
    password = request.data.get("password")

    if not login_value or not password:
        return Response({"detail": "Нужны логин и пароль"}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=login_value, password=password)
    if not user:
        user_obj = User.objects.filter(email=login_value).first()
        if user_obj:
            user = authenticate(request, username=user_obj.username, password=password)

    if not user:
        return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "detail": "Сессия успешно создана",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserProfileSerializer(user).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    return Response({"detail": "Выход выполнен"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def create_user_view(request):
    if request.method == "GET":
        users = User.objects.all().order_by("id")
        return Response(UserProfileSerializer(users, many=True).data)

    serializer = UserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def update_user_view(request, user_id):
    user = get_object_or_404(User, id=user_id)

    if request.method == "DELETE":
        if user.id == request.user.id:
            return Response({"detail": "Нельзя удалить текущего пользователя."}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if user.id == request.user.id and "roles" in request.data:
        requested_roles = request.data.get("roles") or []
        if Role.Code.ADMIN not in requested_roles:
            return Response(
                {"detail": "Нельзя снять с себя роль администратора."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer = UserUpdateSerializer(instance=user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    updated_user = serializer.save()
    return Response(UserProfileSerializer(updated_user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parent_children_view(request):
    _ensure_parent_role(request.user)

    parent_profile = getattr(request.user, "parent_profile", None)
    if not parent_profile:
        return Response([])

    students = [item.user for item in parent_profile.students.select_related("user").all()]
    result = []
    for student in students:
        groups = Group.objects.filter(groupstudent__user=student).order_by("id")
        active_subscription = Subscription.objects.filter(student=student, is_active=True).first()
        result.append(
            {
                "id": student.id,
                "username": student.username,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "email": student.email,
                "groups": [{"id": group.id, "name": group.name} for group in groups],
                "balance": active_subscription.remaining_lessons if active_subscription else 0,
                "valid_from": active_subscription.valid_from if active_subscription else None,
                "valid_until": active_subscription.valid_until if active_subscription else None,
            }
        )

    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parent_attendance_view(request):
    _ensure_parent_role(request.user)

    parent_profile = getattr(request.user, "parent_profile", None)
    if not parent_profile:
        return Response([])

    student_ids = list(parent_profile.students.values_list("user_id", flat=True))
    queryset = (
        AttendanceRecord.objects.filter(student_id__in=student_ids)
        .select_related("student", "lesson", "lesson__group", "lesson__topic")
        .order_by("-lesson__starts_at", "-id")
    )

    requested_student_id = request.query_params.get("student_id")
    if requested_student_id:
        queryset = queryset.filter(student_id=requested_student_id)

    response_data = [
        {
            "id": record.id,
            "lesson_id": record.lesson_id,
            "student_id": record.student_id,
            "student_name": (record.student.get_full_name().strip() or record.student.username),
            "group_name": record.lesson.group.name if record.lesson.group else "",
            "lesson_starts_at": record.lesson.starts_at,
            "lesson_topic": record.lesson.conducted_topic or (record.lesson.topic.title if record.lesson.topic else ""),
            "conducted_description": record.lesson.conducted_description or "",
            "status": record.status,
            "charged": record.charged,
            "grade": record.grade,
            "teacher_comment": record.teacher_comment,
            "homework": record.lesson.homework,
        }
        for record in queryset
    ]

    return Response(response_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parent_billing_view(request):
    _ensure_parent_role(request.user)

    process_pending_payment_intents()

    parent_profile = getattr(request.user, "parent_profile", None)
    if not parent_profile:
        return Response([])

    student_ids = list(parent_profile.students.values_list("user_id", flat=True))
    students = User.objects.filter(id__in=student_ids).order_by("id")

    response_data = []
    for student in students:
        active_subscription = Subscription.objects.filter(student=student, is_active=True).first()
        payments = Payment.objects.filter(subscription__student=student).order_by("-paid_at")[:10]
        payment_intents = PaymentIntent.objects.filter(student=student).order_by("-created_at")[:10]
        response_data.append(
            {
                "student_id": student.id,
                "student_name": (student.get_full_name().strip() or student.username),
                "subscription": {
                    "id": active_subscription.id,
                    "total_lessons": active_subscription.total_lessons,
                    "remaining_lessons": active_subscription.remaining_lessons,
                    "valid_from": active_subscription.valid_from,
                    "valid_until": active_subscription.valid_until,
                    "is_active": active_subscription.is_active,
                }
                if active_subscription
                else None,
                "payments": [
                    {
                        "id": payment.id,
                        "amount": payment.amount,
                        "paid_at": payment.paid_at,
                    }
                    for payment in payments
                ],
                "payment_intents": [
                    {
                        "id": intent.id,
                        "plan": intent.plan,
                        "amount": intent.amount,
                        "lessons": intent.lessons,
                        "status": intent.status,
                        "processed_at": intent.processed_at,
                        "created_at": intent.created_at,
                        "error_message": intent.error_message,
                    }
                    for intent in payment_intents
                ],
            }
        )

    return Response(response_data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def student_projects_view(request):
    _ensure_student_role(request.user)

    if request.method == "GET":
        projects = request.user.projects.all().order_by("-created_at")
        serializer = StudentProjectSerializer(projects, many=True, context={"request": request})
        return Response(serializer.data)

    photos = request.FILES.getlist("photos")
    if not photos or len(photos) < 1 or len(photos) > 5:
        return Response({"error": "Нужно загрузить от 1 до 5 фото."}, status=status.HTTP_400_BAD_REQUEST)

    attachments = request.FILES.getlist("files")
    MAX_FILES = 10
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
    if len(attachments) > MAX_FILES:
        return Response(
            {"error": f"Можно прикрепить не более {MAX_FILES} файлов."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    for attachment in attachments:
        if attachment.size > MAX_FILE_SIZE:
            return Response(
                {"error": f"Файл «{attachment.name}» превышает 25 МБ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    serializer = StudentProjectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    project = StudentProject.objects.create(
        student=request.user,
        title=serializer.validated_data.get("title"),
        description=serializer.validated_data.get("description", ""),
        project_url=serializer.validated_data.get("project_url", ""),
    )

    for photo in photos:
        StudentProjectImage.objects.create(project=project, image=photo)

    for attachment in attachments:
        StudentProjectFile.objects.create(
            project=project,
            file=attachment,
            original_name=attachment.name,
            size=attachment.size or 0,
        )

    response_serializer = StudentProjectSerializer(project, context={"request": request})
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def projects_feed_view(request):
    week_start = timezone.now() - timedelta(days=7)

    projects = (
        StudentProject.objects.select_related("student")
        .prefetch_related("images", "likes")
        .annotate(
            likes_total=Count("likes", distinct=True),
            likes_week=Count("likes", filter=Q(likes__created_at__gte=week_start), distinct=True),
        )
        .order_by("-created_at")
    )

    top_project = (
        projects.order_by("-likes_week", "-created_at").first()
        if projects.exists()
        else None
    )

    serializer = StudentProjectSerializer(
        projects,
        many=True,
        context={"request": request, "like_week_start": week_start},
    )
    top_serializer = (
        StudentProjectSerializer(top_project, context={"request": request, "like_week_start": week_start})
        if top_project
        else None
    )

    return Response(
        {
            "top_project": top_serializer.data if top_serializer else None,
            "projects": serializer.data,
        }
    )


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def project_like_view(request, project_id):
    project = get_object_or_404(StudentProject, id=project_id)
    week_start = timezone.now() - timedelta(days=7)

    if request.method == "POST":
        StudentProjectLike.objects.get_or_create(project=project, user=request.user)
    else:
        StudentProjectLike.objects.filter(project=project, user=request.user).delete()

    total_likes, week_likes = _project_like_stats(project, week_start)
    return Response(
        {
            "likes_count": total_likes,
            "likes_week": week_likes,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_delete_project_view(request, project_id):
    project = get_object_or_404(StudentProject, id=project_id)
    project.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _resolve_portfolio_target(request_user, target_student_id):
    """Определить, чьё портфолио рендерим, и проверить права."""
    if target_student_id is None or str(target_student_id) == str(request_user.id):
        if request_user.roles.filter(code=Role.Code.STUDENT).exists():
            return request_user
        raise PermissionDenied("Раздел доступен только ученикам")

    target = get_object_or_404(User, id=target_student_id)

    is_admin = request_user.is_superuser or request_user.roles.filter(code=Role.Code.ADMIN).exists()
    if is_admin:
        return target

    if request_user.roles.filter(code=Role.Code.PARENT).exists():
        parent_profile = getattr(request_user, "parent_profile", None)
        if parent_profile and parent_profile.students.filter(user_id=target.id).exists():
            return target

    raise PermissionDenied("Нет доступа к портфолио этого ученика")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_student_detail_view(request, student_id):
    """Детали ученика для преподавателя: профиль, группа, посещаемость, оценки, проекты."""
    is_teacher = request.user.roles.filter(code=Role.Code.TEACHER).exists()
    is_admin = request.user.is_superuser or request.user.roles.filter(code=Role.Code.ADMIN).exists()
    if not (is_teacher or is_admin):
        raise PermissionDenied("Доступ только для преподавателей и администраторов")

    student = User.objects.filter(id=student_id, roles__code=Role.Code.STUDENT).first()
    if not student:
        return Response({"detail": "Ученик не найден"}, status=status.HTTP_404_NOT_FOUND)

    # Преподаватель может смотреть только своих учеников.
    if is_teacher and not is_admin:
        shared_group_exists = Group.objects.filter(
            groupteacher__user=request.user,
            groupstudent__user=student,
        ).exists()
        if not shared_group_exists:
            raise PermissionDenied("Этот ученик не учится в ваших группах")

    groups = list(
        Group.objects.filter(groupstudent__user=student)
        .select_related("location", "course")
        .order_by("id")
    )

    records = (
        AttendanceRecord.objects.filter(student=student)
        .select_related("lesson", "lesson__group", "lesson__topic")
        .order_by("-lesson__starts_at", "-id")
    )

    # Виджет посещений: окно N дней (default 90) по всем урокам групп ученика.
    from apps.attendance.models import Lesson as LessonModel

    try:
        widget_days = int(request.query_params.get("days", "90"))
    except (TypeError, ValueError):
        widget_days = 90
    widget_days = max(1, min(widget_days, 730))

    now = timezone.localtime()
    window_start = now - timedelta(days=widget_days)
    window_end = now + timedelta(days=widget_days)
    widget_lessons = (
        LessonModel.objects.filter(
            group__groupstudent__user=student,
            starts_at__gte=window_start,
            starts_at__lte=window_end,
        )
        .select_related("group", "topic")
        .order_by("starts_at")
        .distinct()
    )
    records_by_lesson = {
        r.lesson_id: r
        for r in AttendanceRecord.objects.filter(
            student=student,
            lesson__in=widget_lessons,
        )
    }
    widget_data = []
    for lesson in widget_lessons:
        record = records_by_lesson.get(lesson.id)
        is_past = lesson.starts_at <= now
        if record:
            status_code = record.status
        else:
            status_code = "scheduled" if not is_past else "none"
        widget_data.append(
            {
                "lesson_id": lesson.id,
                "starts_at": lesson.starts_at,
                "status": status_code,
                "is_past": is_past,
                "topic": (
                    lesson.conducted_topic
                    or (lesson.topic.title if lesson.topic_id else "")
                ),
                "description": lesson.conducted_description or "",
                "homework": lesson.homework or "",
                "group_name": lesson.group.name if lesson.group_id else "",
                "grade": record.grade if record else None,
                "teacher_comment": record.teacher_comment if record else "",
            }
        )

    records_data = []
    grades = []
    present_count = 0
    absent_count = 0
    for record in records:
        if record.status == AttendanceRecord.Status.PRESENT:
            present_count += 1
        elif record.status == AttendanceRecord.Status.ABSENT:
            absent_count += 1
        if record.grade is not None:
            grades.append(record.grade)
        records_data.append(
            {
                "id": record.id,
                "lesson_id": record.lesson_id,
                "lesson_starts_at": record.lesson.starts_at,
                "lesson_topic": (
                    record.lesson.conducted_topic
                    or (record.lesson.topic.title if record.lesson.topic_id else "")
                ),
                "group_name": record.lesson.group.name if record.lesson.group_id else "",
                "status": record.status,
                "grade": record.grade,
                "teacher_comment": record.teacher_comment,
            }
        )

    avg_grade = round(sum(grades) / len(grades), 2) if grades else None

    projects = list(
        StudentProject.objects.filter(student=student).order_by("-created_at", "-id")[:20]
    )
    projects_data = StudentProjectSerializer(
        projects, many=True, context={"request": request}
    ).data

    active_subscription = Subscription.objects.filter(student=student, is_active=True).first()

    parent_profiles = (
        User.objects.filter(parent_profile__students__user=student)
        .distinct()
        .order_by("id")
    )
    parents_data = [
        {
            "id": parent.id,
            "full_name": (
                parent.get_full_name().strip() or parent.username
            ),
            "email": parent.email or "",
            "phone": getattr(parent, "phone", "") or "",
        }
        for parent in parent_profiles
    ]

    return Response(
        {
            "student": {
                "id": student.id,
                "username": student.username,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "email": student.email,
                "phone": getattr(student, "phone", "") or "",
                "balance": active_subscription.remaining_lessons if active_subscription else 0,
            },
            "groups": [
                {
                    "id": group.id,
                    "name": group.name,
                    "course_name": group.course.name if group.course_id else "",
                    "location_name": group.location.name if group.location_id else "",
                }
                for group in groups
            ],
            "stats": {
                "total_records": len(records_data),
                "present": present_count,
                "absent": absent_count,
                "grades_count": len(grades),
                "avg_grade": avg_grade,
                "projects_count": StudentProject.objects.filter(student=student).count(),
            },
            "attendance": records_data,
            "attendance_widget": widget_data,
            "projects": projects_data,
            "parents": parents_data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_portfolio_view(request):
    """JSON-портфолио для in-app просмотра.

    Доступно ученику (своё), родителю (своих детей) и админу.
    Возвращает те же данные, что и PDF, в JSON-сериализуемом виде
    (без `image_paths`, с `image_urls`).
    """
    target_student_id = request.query_params.get("student_id")
    student = _resolve_portfolio_target(request.user, target_student_id)
    context = build_portfolio_context(student, request=request)

    payload = {
        "student": {
            "id": student.id,
            "name": context["student_name"],
            "username": context["student_username"],
            "email": context["student_email"],
        },
        "generated_at": context["generated_at"],
        "public_url": context["public_url"],
        "stats": context["stats"],
        "groups": context["groups"],
        "projects": [
            {
                "id": p["id"],
                "title": p["title"],
                "description": p["description"],
                "project_url": p["project_url"],
                "created_at": p["created_at"],
                "likes_count": p["likes_count"],
                "images": p["image_urls"],
                "files": p.get("files", []),
            }
            for p in context["projects"]
        ],
        "lessons": context["lessons"],
        "grades_summary": context["grades_summary"],
    }
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_portfolio_pdf_view(request):
    target_student_id = request.query_params.get("student_id")
    student = _resolve_portfolio_target(request.user, target_student_id)

    pdf_bytes = render_portfolio_pdf(student, request=request)

    safe_name = (student.get_full_name().strip() or student.username).replace(" ", "_")
    filename = f"portfolio_{safe_name}.pdf"

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def public_portfolio_view(request, token):
    profile = StudentProfile.objects.filter(portfolio_token=token).select_related("user").first()
    if not profile:
        raise Http404("Портфолио не найдено")

    context = build_portfolio_context(profile.user, request=request)
    return render(request, "users/portfolio_pdf.html", context)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request_view(request):
    email = (request.data.get("email") or "").strip()
    request_password_reset(email, request=request)
    # Никогда не палим, существует ли email — отвечаем одинаково
    return Response(
        {"detail": "Если такой email зарегистрирован, на него отправлено письмо со ссылкой для сброса пароля."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm_view(request):
    token = request.data.get("token") or ""
    new_password = request.data.get("new_password") or ""
    try:
        confirm_password_reset(token, new_password)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Пароль успешно изменён."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    user = request.user
    old_password = request.data.get("old_password") or ""
    new_password = request.data.get("new_password") or ""

    if not user.must_change_password:
        # Обычная смена — проверяем старый пароль
        if not user.check_password(old_password):
            return Response({"detail": "Текущий пароль указан неверно."}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
        return Response(
            {"detail": "Пароль должен быть не короче 8 символов."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])
    return Response({"detail": "Пароль обновлён."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def admin_reset_user_password_view(request, user_id):
    target = get_object_or_404(User, id=user_id)
    new_password = issue_admin_reset(target)
    return Response(
        {
            "detail": "Сгенерирован одноразовый пароль. Передайте его пользователю — при первом входе он обязан будет сменить пароль.",
            "username": target.username,
            "one_time_password": new_password,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def churn_risk_view(request):
    """FR-10: отчёт по ученикам с риском оттока."""
    return Response(compute_churn_report())


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def dashboard_metrics_view(request):
    """FR-12: метрики для админ-дашборда (KPI + разбивка по группам)."""
    metrics = compute_dashboard_metrics(
        date_from_str=request.query_params.get("from"),
        date_to_str=request.query_params.get("to"),
        group_id=request.query_params.get("group_id") or None,
    )
    return Response(metrics)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def dashboard_export_csv_view(request):
    """FR-12: экспорт сводного отчёта за период в CSV."""
    body = render_dashboard_csv(
        date_from_str=request.query_params.get("from"),
        date_to_str=request.query_params.get("to"),
        group_id=request.query_params.get("group_id") or None,
    )
    response = HttpResponse(body, content_type="text/csv; charset=utf-8")
    period_from = request.query_params.get("from") or "period"
    period_to = request.query_params.get("to") or "now"
    response["Content-Disposition"] = (
        f'attachment; filename="kiberone_report_{period_from}_{period_to}.csv"'
    )
    return response


