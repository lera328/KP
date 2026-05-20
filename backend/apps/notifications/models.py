import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificationTemplate(models.Model):
    class EventType(models.TextChoices):
        ABSENCE = "absence", "Пропуск"
        MAKEUP_APPROVED = "makeup_approved", "Подтверждение отработки"
        PAYMENT_REMINDER = "payment_reminder", "Напоминание о платеже"

    event_type = models.CharField(max_length=32, choices=EventType.choices, unique=True)
    title = models.CharField(max_length=128)
    body = models.TextField(
        help_text=(
            "Шаблон сообщения. Поддерживаются плейсхолдеры в стиле Python-format, "
            "например {student_name}, {lesson_topic}, {lesson_starts_at}, {remaining_lessons}."
        ),
    )
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_event_type_display()}"

    def render(self, context):
        try:
            return self.body.format(**context)
        except (KeyError, IndexError, ValueError):
            return self.body


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


def _generate_link_token() -> str:
    return secrets.token_urlsafe(24)


class TelegramLinkToken(models.Model):
    """Одноразовый токен для привязки Telegram-аккаунта пользователя.

    Пользователь нажимает «Подключить Telegram» — получает deep-link
    `https://t.me/<bot>?start=<token>`. Бот по webhook получает
    /start <token>, находит токен и сохраняет chat_id пользователю.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_link_tokens",
    )
    token = models.CharField(max_length=64, unique=True, default=_generate_link_token)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    TTL_HOURS = 24

    def is_expired(self) -> bool:
        return (timezone.now() - self.created_at).total_seconds() > self.TTL_HOURS * 3600

    def is_valid(self) -> bool:
        return self.used_at is None and not self.is_expired()

    def __str__(self):
        return f"link-token user={self.user_id} used={bool(self.used_at)}"
