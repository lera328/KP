from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ParentProfile, Role, StudentProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    roles = serializers.SlugRelatedField(slug_field="code", many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "roles"]


class UserCreateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.ChoiceField(choices=Role.Code.values), write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "roles",
        ]

    def create(self, validated_data):
        role_codes = validated_data.pop("roles", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        roles = list(Role.objects.filter(code__in=role_codes))
        user.roles.set(roles)

        if any(role.code == Role.Code.STUDENT for role in roles):
            StudentProfile.objects.get_or_create(user=user)
        if any(role.code == Role.Code.PARENT for role in roles):
            ParentProfile.objects.get_or_create(user=user)

        return user
