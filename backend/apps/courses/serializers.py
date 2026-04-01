from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Course, Group, GroupStudent, GroupTeacher

User = get_user_model()


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "name", "description", "is_active"]


class GroupSerializer(serializers.ModelSerializer):
    student_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    teacher_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Group
        fields = ["id", "name", "course", "is_active", "student_ids", "teacher_ids"]

    def create(self, validated_data):
        student_ids = validated_data.pop("student_ids", [])
        teacher_ids = validated_data.pop("teacher_ids", [])
        group = Group.objects.create(**validated_data)

        for student_id in student_ids:
            GroupStudent.objects.get_or_create(group=group, user_id=student_id)
        for teacher_id in teacher_ids:
            GroupTeacher.objects.get_or_create(group=group, user_id=teacher_id)

        return group
