from django.conf import settings
from django.db import models

from apps.courses.models import Course, Group


class LessonTopic(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="topics")
    title = models.CharField(max_length=255)

    def __str__(self):
        return self.title


class Lesson(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="lessons")
    topic = models.ForeignKey(LessonTopic, on_delete=models.PROTECT, related_name="lessons")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="taught_lessons")
    starts_at = models.DateTimeField()
    is_extra = models.BooleanField(default=False)
    is_makeup_slot = models.BooleanField(default=False)
    conducted_topic = models.CharField(max_length=255, blank=True)
    conducted_description = models.TextField(blank=True)


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Присутствовал"
        ABSENT = "absent", "Пропуск"
        MAKEUP = "makeup", "Отработка"

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="attendance_records")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attendance_records")
    status = models.CharField(max_length=16, choices=Status.choices)
    charged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("lesson", "student")


class MakeUpRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Запрошена"
        COMPLETED = "completed", "Проведена"
        APPROVED = "approved", "Подтверждена администратором"

    absence_record = models.ForeignKey(AttendanceRecord, on_delete=models.CASCADE, related_name="makeup_requests")
    makeup_lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="makeup_requests")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="makeup_requests")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REQUESTED)
    completed_record = models.OneToOneField(
        AttendanceRecord,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="completed_makeup_request",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_makeups",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.absence_record.status != AttendanceRecord.Status.ABSENT:
            raise ValueError("Отработка может быть создана только для пропуска")
        missed_topic = self.absence_record.lesson.topic_id
        makeup_topic = self.makeup_lesson.topic_id
        if missed_topic != makeup_topic:
            raise ValueError("Отработка должна быть по теме пропущенного занятия")
