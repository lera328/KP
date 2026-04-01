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

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]
