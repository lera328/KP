from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdminRole

from .models import Lesson, LessonTopic, MakeUpRequest
from .serializers import (
    AttendanceMarkSerializer,
    LessonSerializer,
    LessonTopicSerializer,
    MakeUpApproveSerializer,
    MakeUpRequestCreateSerializer,
)


class LessonTopicListCreateView(generics.ListCreateAPIView):
    queryset = LessonTopic.objects.all().order_by("id")
    serializer_class = LessonTopicSerializer
    permission_classes = [IsAuthenticated]


class LessonListCreateView(generics.ListCreateAPIView):
    queryset = Lesson.objects.all().order_by("id")
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]


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
