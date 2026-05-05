from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsAdminRole
from .models import User, Role
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
        .select_related("student", "lesson", "lesson__group")
        .order_by("-lesson__starts_at", "-id")
    )

    requested_student_id = request.query_params.get("student_id")
    if requested_student_id:
        queryset = queryset.filter(student_id=requested_student_id)

    response_data = [
        {
            "id": record.id,
            "student_id": record.student_id,
            "student_name": (record.student.get_full_name().strip() or record.student.username),
            "group_name": record.lesson.group.name,
            "lesson_starts_at": record.lesson.starts_at,
            "status": record.status,
            "charged": record.charged,
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
def student_projects_view(request):
    _ensure_student_role(request.user)

    if request.method == "GET":
        projects = request.user.projects.all().order_by("-created_at")
        serializer = StudentProjectSerializer(projects, many=True)
        return Response(serializer.data)

    serializer = StudentProjectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    project = serializer.save(student=request.user)
    return Response(StudentProjectSerializer(project).data, status=status.HTTP_201_CREATED)
