from django.conf import settings
from django.db import models


class NotificationEvent(models.Model):
    class EventType(models.TextChoices):
        ABSENCE = "absence", "Пропуск"
        MAKEUP_APPROVED = "makeup_approved", "Подтверждение отработки"
        PAYMENT_REMINDER = "payment_reminder", "Напоминание о платеже"

    class DeliveryStatus(models.TextChoices):
        SENT = "sent", "Отправлено"
        FAILED = "failed", "Ошибка"
        SKIPPED = "skipped", "Пропущено"

    event_type = models.CharField(max_length=32, choices=EventType.choices)
    status = models.CharField(max_length=16, choices=DeliveryStatus.choices)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_events",
    )
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="received_notifications",
        null=True,
        blank=True,
    )
    message = models.TextField()
    provider_response = models.TextField(blank=True)
    error_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.event_type} -> {self.status} (student={self.student_id})"
