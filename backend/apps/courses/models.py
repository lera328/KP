from django.conf import settings
from django.db import models


class Location(models.Model):
    """Точка KiberOne (например, Куйбышева, Мира, Карла Маркса)."""
    name = models.CharField(max_length=128, unique=True)
    address = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


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
    location = models.ForeignKey(
        Location, null=True, blank=True, on_delete=models.PROTECT, related_name="groups"
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


class GroupComment(models.Model):
    """Заметка/комментарий преподавателя или администратора о группе."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="group_comments",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):  # pragma: no cover - debug helper
        return f"GroupComment(group={self.group_id}, author={self.author_id})"
