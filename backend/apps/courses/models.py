from django.conf import settings
from django.db import models


class Course(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Group(models.Model):
    name = models.CharField(max_length=255)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="groups")
    weekly_lesson_weekday = models.PositiveSmallIntegerField(null=True, blank=True)
    weekly_lesson_time = models.TimeField(null=True, blank=True)
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="GroupStudent",
        related_name="student_groups",
        blank=True,
    )
    teachers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="GroupTeacher",
        related_name="teacher_groups",
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class GroupStudent(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("group", "user")


class GroupTeacher(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("group", "user")
