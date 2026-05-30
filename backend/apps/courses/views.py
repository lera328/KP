from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdminRole

from .models import Course, Group, GroupComment, Location
from .serializers import CourseSerializer, GroupSerializer, LocationSerializer


class LocationListCreateView(generics.ListCreateAPIView):
    serializer_class = LocationSerializer

    def get_queryset(self):
        # Администраторы видят все локации (включая неактивные), остальные — только активные
        user = self.request.user
        is_admin = user.is_superuser or user.roles.filter(code="admin").exists()
        if is_admin:
            return Location.objects.all().order_by("name")
        return Location.objects.filter(is_active=True).order_by("name")

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class LocationRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Location.objects.all().order_by("name")
    serializer_class = LocationSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class CourseListCreateView(generics.ListCreateAPIView):
    queryset = Course.objects.all().order_by("id")
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class CourseRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all().order_by("id")
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class GroupListCreateView(generics.ListCreateAPIView):
    queryset = Group.objects.all().order_by("id")
    serializer_class = GroupSerializer

    def get_queryset(self):
        queryset = Group.objects.all().order_by("id")
        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        is_admin = user.is_superuser or user.roles.filter(code="admin").exists()
        if is_admin:
            return queryset

        is_teacher = user.roles.filter(code="teacher").exists()
        if is_teacher:
            return queryset.filter(groupteacher__user=user).distinct()

        is_student = user.roles.filter(code="student").exists()
        if is_student:
            return queryset.filter(groupstudent__user=user).distinct()

        return queryset

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]


class GroupRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Group.objects.all().order_by("id")
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Group.objects.all().order_by("id")
        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        is_admin = user.is_superuser or user.roles.filter(code="admin").exists()
        if is_admin:
            return queryset

        is_teacher = user.roles.filter(code="teacher").exists()
        if is_teacher:
            return queryset.filter(groupteacher__user=user).distinct()

        is_student = user.roles.filter(code="student").exists()
        if is_student:
            return queryset.filter(groupstudent__user=user).distinct()

        return queryset.none()


def _can_access_group(user, group):
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.roles.filter(code="admin").exists():
        return True
    if user.roles.filter(code="teacher").exists():
        return group.teachers.filter(id=user.id).exists()
    return False


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def group_comments_view(request, group_id):
    """Список и добавление текстовых заметок преподавателя/администратора по группе."""
    group = Group.objects.filter(id=group_id).first()
    if not group:
        return Response({"detail": "Группа не найдена"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_access_group(request.user, group):
        raise PermissionDenied("Доступ запрещён")

    if request.method == "GET":
        comments = group.comments.select_related("author").all()
        data = [
            {
                "id": comment.id,
                "text": comment.text,
                "created_at": comment.created_at,
                "author_id": comment.author_id,
                "author_name": (
                    (comment.author.get_full_name().strip() or comment.author.username)
                    if comment.author
                    else "Удалённый пользователь"
                ),
                "is_mine": comment.author_id == request.user.id,
            }
            for comment in comments
        ]
        return Response(data)

    text = (request.data.get("text") or "").strip()
    if not text:
        return Response(
            {"detail": "Текст комментария не может быть пустым."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    comment = GroupComment.objects.create(group=group, author=request.user, text=text)
    return Response(
        {
            "id": comment.id,
            "text": comment.text,
            "created_at": comment.created_at,
            "author_id": comment.author_id,
            "author_name": (
                request.user.get_full_name().strip() or request.user.username
            ),
            "is_mine": True,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def group_comment_delete_view(request, group_id, comment_id):
    group = Group.objects.filter(id=group_id).first()
    if not group:
        return Response({"detail": "Группа не найдена"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_access_group(request.user, group):
        raise PermissionDenied("Доступ запрещён")
    comment = GroupComment.objects.filter(id=comment_id, group=group).first()
    if not comment:
        return Response({"detail": "Комментарий не найден"}, status=status.HTTP_404_NOT_FOUND)
    is_admin = request.user.is_superuser or request.user.roles.filter(code="admin").exists()
    if not is_admin and comment.author_id != request.user.id:
        raise PermissionDenied("Удалять можно только свои комментарии")
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
