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
    students = serializers.SerializerMethodField(read_only=True)
    teachers = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "course",
            "is_active",
            "weekly_lesson_weekday",
            "weekly_lesson_time",
            "student_ids",
            "teacher_ids",
            "students",
            "teachers",
        ]

    def get_students(self, obj):
        students = obj.students.all().order_by("id")
        return [
            {
                "id": student.id,
                "username": student.username,
                "first_name": student.first_name,
                "last_name": student.last_name,
            }
            for student in students
        ]

    def get_teachers(self, obj):
        teachers = obj.teachers.all().order_by("id")
        return [
            {
                "id": teacher.id,
                "username": teacher.username,
                "first_name": teacher.first_name,
                "last_name": teacher.last_name,
            }
            for teacher in teachers
        ]

    def create(self, validated_data):
        student_ids = validated_data.pop("student_ids", [])
        teacher_ids = validated_data.pop("teacher_ids", [])
        group = Group.objects.create(**validated_data)

        for student_id in student_ids:
            GroupStudent.objects.get_or_create(group=group, user_id=student_id)
        for teacher_id in teacher_ids:
            GroupTeacher.objects.get_or_create(group=group, user_id=teacher_id)

        return group

    def update(self, instance, validated_data):
        student_ids = validated_data.pop("student_ids", None)
        teacher_ids = validated_data.pop("teacher_ids", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if student_ids is not None:
            GroupStudent.objects.filter(group=instance).delete()
            for student_id in student_ids:
                GroupStudent.objects.get_or_create(group=instance, user_id=student_id)

        if teacher_ids is not None:
            GroupTeacher.objects.filter(group=instance).delete()
            for teacher_id in teacher_ids:
                GroupTeacher.objects.get_or_create(group=instance, user_id=teacher_id)

        return instance
