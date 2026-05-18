from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.courses.models import Group, GroupStudent


def _absolute_media_url(url: str) -> str:
    """Построить абсолютный URL к медиа, доступный из браузера.

    Использует PUBLIC_FRONTEND_URL, т.к. запросы к API идут через Vite-прокси,
    и request.build_absolute_uri возвращает несуществующий для браузера хост.
    """
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = getattr(settings, "PUBLIC_FRONTEND_URL", "").rstrip("/")
    if not base:
        return url
    if not url.startswith("/"):
        url = "/" + url
    return f"{base}{url}"

from .models import (
    ParentProfile,
    Role,
    StudentProfile,
    StudentProject,
    StudentProjectFile,
    StudentProjectImage,
    StudentProjectLike,
)

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    roles = serializers.SlugRelatedField(slug_field="code", many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "telegram_chat_id",
            "roles",
            "is_superuser",
            "must_change_password",
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.ChoiceField(choices=Role.Code.values), write_only=True)
    group_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
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
            "telegram_chat_id",
            "roles",
            "group_ids",
        ]

    def validate(self, attrs):
        role_codes = attrs.get("roles", [])
        group_ids = attrs.get("group_ids", [])

        if len(role_codes) != 1:
            raise serializers.ValidationError({"roles": "У пользователя должна быть ровно одна роль."})

        is_student = Role.Code.STUDENT in role_codes
        is_parent = Role.Code.PARENT in role_codes

        if is_parent:
            phone = (attrs.get("phone") or "").strip()
            if not phone:
                raise serializers.ValidationError(
                    {"phone": "Для родителя номер телефона обязателен."}
                )

        if is_student and group_ids:
            if len(group_ids) != 1:
                raise serializers.ValidationError({"group_ids": "Ученик может быть прикреплён максимум к одной группе."})

            existing_group_ids = set(Group.objects.filter(id__in=group_ids).values_list("id", flat=True))
            missing_group_ids = [group_id for group_id in group_ids if group_id not in existing_group_ids]
            if missing_group_ids:
                raise serializers.ValidationError({"group_ids": "Некоторые группы не найдены."})

        return attrs

    def create(self, validated_data):
        role_codes = validated_data.pop("roles", [])
        group_ids = validated_data.pop("group_ids", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        roles = list(Role.objects.filter(code__in=role_codes))
        user.roles.set(roles)

        if any(role.code == Role.Code.STUDENT for role in roles):
            StudentProfile.objects.get_or_create(user=user)
            if group_ids:
                GroupStudent.objects.get_or_create(group_id=group_ids[0], user=user)
        if any(role.code == Role.Code.PARENT for role in roles):
            ParentProfile.objects.get_or_create(user=user)

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=Role.Code.values),
        write_only=True,
        required=False,
    )
    group_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "telegram_chat_id",
            "roles",
            "group_ids",
        ]
        extra_kwargs = {
            "username": {"required": False},
            "first_name": {"required": False},
            "last_name": {"required": False},
            "email": {"required": False},
            "phone": {"required": False},
            "telegram_chat_id": {"required": False},
        }

    def validate(self, attrs):
        role_codes = attrs.get("roles")
        if role_codes is None:
            role_codes = list(self.instance.roles.values_list("code", flat=True))

        if len(role_codes) != 1:
            raise serializers.ValidationError({"roles": "У пользователя должна быть ровно одна роль."})

        is_student = Role.Code.STUDENT in role_codes
        is_parent = Role.Code.PARENT in role_codes

        if is_parent:
            # phone может прийти в attrs, иначе берём сохранённый у юзера
            phone_in_payload = attrs.get("phone")
            resolved_phone = phone_in_payload if phone_in_payload is not None else (self.instance.phone or "")
            if not (resolved_phone or "").strip():
                raise serializers.ValidationError(
                    {"phone": "Для родителя номер телефона обязателен."}
                )

        has_group_ids_in_payload = "group_ids" in attrs
        group_ids = attrs.get("group_ids")

        if group_ids is None:
            group_ids = list(GroupStudent.objects.filter(user=self.instance).values_list("group_id", flat=True))

        if is_student and group_ids and len(group_ids) != 1:
            raise serializers.ValidationError({"group_ids": "Ученик может быть прикреплён максимум к одной группе."})

        if has_group_ids_in_payload:
            existing_group_ids = set(Group.objects.filter(id__in=group_ids).values_list("id", flat=True))
            missing_group_ids = [group_id for group_id in group_ids if group_id not in existing_group_ids]
            if missing_group_ids:
                raise serializers.ValidationError({"group_ids": "Некоторые группы не найдены."})

        return attrs

    def update(self, instance, validated_data):
        role_codes = validated_data.pop("roles", None)
        group_ids = validated_data.pop("group_ids", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if role_codes is not None:
            roles = list(Role.objects.filter(code__in=role_codes))
            instance.roles.set(roles)

        current_role_codes = list(instance.roles.values_list("code", flat=True))
        is_student = Role.Code.STUDENT in current_role_codes
        is_parent = Role.Code.PARENT in current_role_codes

        if is_student:
            StudentProfile.objects.get_or_create(user=instance)
        if is_parent:
            ParentProfile.objects.get_or_create(user=instance)

        if group_ids is not None or role_codes is not None:
            if is_student:
                target_group_ids = group_ids
                if target_group_ids is None:
                    target_group_ids = list(
                        GroupStudent.objects.filter(user=instance).values_list("group_id", flat=True)
                    )

                GroupStudent.objects.filter(user=instance).exclude(group_id__in=target_group_ids).delete()
                if target_group_ids:
                    GroupStudent.objects.get_or_create(group_id=target_group_ids[0], user=instance)
            else:
                GroupStudent.objects.filter(user=instance).delete()

        return instance


class StudentProjectSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    likes_week = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = StudentProject
        fields = [
            "id",
            "student_id",
            "student_name",
            "title",
            "description",
            "project_url",
            "images",
            "files",
            "likes_count",
            "likes_week",
            "liked_by_me",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "student_id",
            "student_name",
            "images",
            "files",
            "likes_count",
            "likes_week",
            "liked_by_me",
            "created_at",
        ]

    def get_student_name(self, obj):
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username

    def get_images(self, obj):
        request = self.context.get("request")
        images = getattr(obj, "images", None)
        if images is None:
            images = StudentProjectImage.objects.filter(project=obj)

        payload = []
        for image in images.all():
            url = image.image.url if image.image else ""
            url = _absolute_media_url(url)
            payload.append({"id": image.id, "url": url})
        return payload

    def get_files(self, obj):
        files = getattr(obj, "files", None)
        if files is None:
            files = StudentProjectFile.objects.filter(project=obj)

        payload = []
        for item in files.all():
            url = item.file.url if item.file else ""
            url = _absolute_media_url(url)
            name = item.original_name or (item.file.name.rsplit("/", 1)[-1] if item.file else "")
            payload.append({
                "id": item.id,
                "url": url,
                "name": name,
                "size": item.size,
            })
        return payload

    def get_likes_count(self, obj):
        return getattr(obj, "likes_total", None) or StudentProjectLike.objects.filter(project=obj).count()

    def get_likes_week(self, obj):
        if hasattr(obj, "likes_week"):
            return obj.likes_week
        week_start = self.context.get("like_week_start")
        if week_start is None:
            return 0
        return StudentProjectLike.objects.filter(project=obj, created_at__gte=week_start).count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return StudentProjectLike.objects.filter(project=obj, user=request.user).exists()
