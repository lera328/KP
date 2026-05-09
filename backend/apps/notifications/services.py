import json
import os
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.db.models import Q

from apps.finance.models import Subscription
from apps.users.models import ParentProfile

from .models import NotificationEvent, NotificationTemplate


DEFAULT_TEMPLATES = {
    NotificationTemplate.EventType.ABSENCE: {
        "title": "Уведомление о пропуске",
        "body": (
            "⚠️ Пропуск занятия\n"
            "Ученик: {student_name}\n"
            "Тема: {lesson_topic}\n"
            "Дата: {lesson_starts_at}"
        ),
    },
    NotificationTemplate.EventType.MAKEUP_APPROVED: {
        "title": "Подтверждение отработки",
        "body": (
            "✅ Отработка подтверждена\n"
            "Ученик: {student_name}\n"
            "Тема: {lesson_topic}\n"
            "Дата отработки: {lesson_starts_at}"
        ),
    },
    NotificationTemplate.EventType.PAYMENT_REMINDER: {
        "title": "Напоминание об оплате",
        "body": (
            "💳 Напоминание об оплате\n"
            "Ученик: {student_name}\n"
            "Осталось занятий: {remaining_lessons}\n"
            "Пожалуйста, пополните абонемент."
        ),
    },
}


def _render_template(event_type, context, fallback):
    template = NotificationTemplate.objects.filter(event_type=event_type, is_active=True).first()
    if not template:
        defaults = DEFAULT_TEMPLATES.get(event_type)
        if defaults:
            template, _ = NotificationTemplate.objects.get_or_create(
                event_type=event_type,
                defaults={"title": defaults["title"], "body": defaults["body"]},
            )
    if template:
        return template.render(context)
    return fallback


def _send_telegram_message(chat_id: str, message: str):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return NotificationEvent.DeliveryStatus.SKIPPED, "TELEGRAM_BOT_TOKEN is empty"

    if not chat_id:
        return NotificationEvent.DeliveryStatus.SKIPPED, "telegram_chat_id is empty"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = urlencode({"chat_id": chat_id, "text": message})

    try:
        with urlopen(f"{url}?{payload}", timeout=10) as response:
            body = response.read().decode("utf-8")
        return NotificationEvent.DeliveryStatus.SENT, body
    except Exception as exc:
        return NotificationEvent.DeliveryStatus.FAILED, str(exc)


def _parent_users_for_student(student_user_id: int):
    return (
        ParentProfile.objects.filter(students__user_id=student_user_id)
        .select_related("user")
        .distinct()
    )


def _create_notification_log(event_type, student, parent, message, status, details):
    return NotificationEvent.objects.create(
        event_type=event_type,
        status=status,
        student=student,
        parent=parent,
        message=message,
        provider_response=details if status == NotificationEvent.DeliveryStatus.SENT else "",
        error_text=details if status != NotificationEvent.DeliveryStatus.SENT else "",
    )


def notify_parents_about_absence(attendance_record):
    student = attendance_record.student
    lesson = attendance_record.lesson
    context = {
        "student_name": student.get_full_name() or student.username,
        "lesson_topic": lesson.topic.title,
        "lesson_starts_at": lesson.starts_at.strftime("%d.%m.%Y %H:%M"),
    }
    message = _render_template(
        NotificationTemplate.EventType.ABSENCE,
        context,
        fallback=(
            f"⚠️ Пропуск занятия\n"
            f"Ученик: {context['student_name']}\n"
            f"Тема: {context['lesson_topic']}\n"
            f"Дата: {context['lesson_starts_at']}"
        ),
    )

    sent = 0
    failed = 0
    skipped = 0

    for parent_profile in _parent_users_for_student(student.id):
        parent = parent_profile.user
        status, details = _send_telegram_message(parent.telegram_chat_id, message)
        _create_notification_log(NotificationEvent.EventType.ABSENCE, student, parent, message, status, details)
        if status == NotificationEvent.DeliveryStatus.SENT:
            sent += 1
        elif status == NotificationEvent.DeliveryStatus.FAILED:
            failed += 1
        else:
            skipped += 1

    return {"sent": sent, "failed": failed, "skipped": skipped}


def notify_parents_about_makeup_approval(makeup_request):
    student = makeup_request.student
    lesson = makeup_request.makeup_lesson
    # У слота отработки темы может не быть — берём тему пропущенного занятия как ориентир.
    topic_title = ""
    if lesson and lesson.topic_id:
        topic_title = lesson.topic.title
    elif makeup_request.absence_record_id and makeup_request.absence_record.lesson.topic_id:
        topic_title = makeup_request.absence_record.lesson.topic.title
    else:
        topic_title = "—"
    context = {
        "student_name": student.get_full_name() or student.username,
        "lesson_topic": topic_title,
        "lesson_starts_at": lesson.starts_at.strftime("%d.%m.%Y %H:%M"),
    }
    message = _render_template(
        NotificationTemplate.EventType.MAKEUP_APPROVED,
        context,
        fallback=(
            f"✅ Отработка подтверждена\n"
            f"Ученик: {context['student_name']}\n"
            f"Тема: {context['lesson_topic']}\n"
            f"Дата отработки: {context['lesson_starts_at']}"
        ),
    )

    sent = 0
    failed = 0
    skipped = 0

    for parent_profile in _parent_users_for_student(student.id):
        parent = parent_profile.user
        status, details = _send_telegram_message(parent.telegram_chat_id, message)
        _create_notification_log(NotificationEvent.EventType.MAKEUP_APPROVED, student, parent, message, status, details)
        if status == NotificationEvent.DeliveryStatus.SENT:
            sent += 1
        elif status == NotificationEvent.DeliveryStatus.FAILED:
            failed += 1
        else:
            skipped += 1

    return {"sent": sent, "failed": failed, "skipped": skipped}


def send_low_balance_payment_reminders(threshold=None):
    if threshold is None:
        threshold = settings.PAYMENT_REMINDER_LESSON_THRESHOLD

    subscriptions = Subscription.objects.filter(
        is_active=True,
        remaining_lessons__lte=threshold,
    ).select_related("student")

    totals = {
        "subscriptions": subscriptions.count(),
        "sent": 0,
        "failed": 0,
        "skipped": 0,
    }

    for subscription in subscriptions:
        student = subscription.student
        context = {
            "student_name": student.get_full_name() or student.username,
            "remaining_lessons": subscription.remaining_lessons,
        }
        message = _render_template(
            NotificationTemplate.EventType.PAYMENT_REMINDER,
            context,
            fallback=(
                f"💳 Напоминание об оплате\n"
                f"Ученик: {context['student_name']}\n"
                f"Осталось занятий: {context['remaining_lessons']}\n"
                f"Пожалуйста, пополните абонемент."
            ),
        )

        for parent_profile in _parent_users_for_student(student.id):
            parent = parent_profile.user
            status, details = _send_telegram_message(parent.telegram_chat_id, message)
            _create_notification_log(NotificationEvent.EventType.PAYMENT_REMINDER, student, parent, message, status, details)
            if status == NotificationEvent.DeliveryStatus.SENT:
                totals["sent"] += 1
            elif status == NotificationEvent.DeliveryStatus.FAILED:
                totals["failed"] += 1
            else:
                totals["skipped"] += 1

    return totals
