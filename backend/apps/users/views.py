from django.contrib.auth import authenticate, login, logout
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .permissions import IsAdminRole
from .serializers import UserCreateSerializer, UserProfileSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def session_login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)
    return Response({"detail": "Сессия успешно создана"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"detail": "Выход выполнен"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def create_user_view(request):
    serializer = UserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)
