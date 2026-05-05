from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAdminRole

from .models import Course, Group
from .serializers import CourseSerializer, GroupSerializer


class CourseListCreateView(generics.ListCreateAPIView):
    queryset = Course.objects.all().order_by("id")
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method == "POST":
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
