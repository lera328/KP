"""FR-11 — авто-подбор слотов отработки и one-click подтверждение родителем."""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.users.models import ParentProfile

from .models import AttendanceRecord, Lesson, MakeUpInvite, MakeUpRequest


SUGGEST_LIMIT = 3
INVITE_TTL_DAYS = 7


def _suggest_slots(absence: AttendanceRecord):
    """Ближайшие свободные слоты отработки (без привязки к теме). Учитывает capacity."""
    from django.db.models import Count, Q, F

    used_lesson_ids = set(
        MakeUpRequest.objects.filter(student_id=absence.student_id).values_list(
            "makeup_lesson_id", flat=True
        )
    )
    return list(
        Lesson.objects.filter(
            is_makeup_slot=True,
            starts_at__gte=timezone.now(),
        )
        .annotate(
            booked=Count(
                "makeup_requests",
                filter=Q(
                    makeup_requests__status__in=[
                        MakeUpRequest.Status.REQUESTED,
                        MakeUpRequest.Status.COMPLETED,
                        MakeUpRequest.Status.APPROVED,
                    ]
                ),
            )
        )
        .filter(booked__lt=F("makeup_capacity"))
        .exclude(id__in=used_lesson_ids)
        .select_related("location", "teacher")
        .order_by("starts_at")[:SUGGEST_LIMIT]
    )


def _recipient_emails(student) -> list[tuple[str, str]]:
    """Возвращает [(email, имя_для_адресата)] родителей ученика. Только родители — детям не пишем."""
    recipients: list[tuple[str, str]] = []
    parents = ParentProfile.objects.filter(students__user_id=student.id).select_related("user")
    for profile in parents:
        user = profile.user
        if user.email:
            recipients.append((user.email.lower(), user.get_full_name() or user.username))
    return recipients


def _format_slot(slot: Lesson) -> str:
    teacher_name = slot.teacher.get_full_name().strip() or slot.teacher.username
    location_name = slot.location.name if slot.location_id else "—"
    return (
        f"• {slot.starts_at.strftime('%d.%m.%Y %H:%M')} — "
        f"локация «{location_name}», преподаватель {teacher_name}"
    )


def notify_absence_makeup_options(absence: AttendanceRecord) -> dict:
    """FR-11: подобрать слоты, создать invites и отправить email родителю."""
    if absence.status != AttendanceRecord.Status.ABSENT:
        return {"sent": 0, "slots": 0, "skipped_reason": "not-absent"}

    slots = _suggest_slots(absence)
    if not slots:
        return {"sent": 0, "slots": 0, "skipped_reason": "no-slots"}

    recipients = _recipient_emails(absence.student)
    if not recipients:
        return {"sent": 0, "slots": len(slots), "skipped_reason": "no-email"}

    expires_at = timezone.now() + timedelta(days=INVITE_TTL_DAYS)
    base_url = settings.PUBLIC_FRONTEND_URL.rstrip("/")
    student_name = absence.student.get_full_name().strip() or absence.student.username
    lesson_topic = absence.lesson.topic.title if absence.lesson.topic_id else "без темы"
    missed_at = absence.lesson.starts_at.strftime("%d.%m.%Y %H:%M")

    sent = 0
    for email, recipient_name in recipients:
        invites = []
        with transaction.atomic():
            for slot in slots:
                invite = MakeUpInvite.objects.create(
                    absence_record=absence,
                    makeup_lesson=slot,
                    sent_to_email=email,
                    expires_at=expires_at,
                )
                invites.append((slot, invite))

        lines = [
            f"Здравствуйте, {recipient_name}!",
            "",
            f"Ученик {student_name} пропустил занятие по теме «{lesson_topic}» ({missed_at}).",
            "Чтобы не отставать от программы, выберите подходящий слот отработки —",
            "достаточно одного клика по ссылке ниже:",
            "",
        ]
        for slot, invite in invites:
            link = f"{base_url}/m/{invite.token}"
            lines.append(_format_slot(slot))
            lines.append(f"  Подтвердить: {link}")
            lines.append("")
        lines.append(
            f"Ссылки действительны {INVITE_TTL_DAYS} дней. "
            "Если ни один из слотов не подходит, напишите администратору КиберШкола."
        )

        try:
            send_mail(
                subject=f"Отработка для {student_name} — КиберШкола",
                message="\n".join(lines),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
            sent += 1
        except Exception:  # noqa: BLE001
            pass

    return {"sent": sent, "slots": len(slots), "recipients": len(recipients)}


def get_invite_details(token: str) -> dict | None:
    invite = (
        MakeUpInvite.objects.select_related(
            "absence_record__lesson__topic",
            "absence_record__lesson__group",
            "absence_record__student",
            "makeup_lesson__location",
            "makeup_lesson__teacher",
        )
        .filter(token=token)
        .first()
    )
    if invite is None:
        return None

    absence = invite.absence_record
    slot = invite.makeup_lesson
    teacher_name = slot.teacher.get_full_name().strip() or slot.teacher.username

    state = "active"
    if invite.used_at is not None:
        state = "used"
    elif invite.expires_at < timezone.now():
        state = "expired"

    return {
        "state": state,
        "expires_at": invite.expires_at,
        "used_at": invite.used_at,
        "student_name": absence.student.get_full_name().strip() or absence.student.username,
        "missed_topic": absence.lesson.topic.title if absence.lesson.topic_id else "без темы",
        "missed_starts_at": absence.lesson.starts_at,
        "missed_group": absence.lesson.group.name if absence.lesson.group_id else "",
        "makeup_starts_at": slot.starts_at,
        "makeup_location": slot.location.name if slot.location_id else "",
        "makeup_teacher": teacher_name,
    }


@transaction.atomic
def accept_invite(token: str) -> dict:
    """Применить токен и создать MakeUpRequest. Возвращает результат для UI."""
    invite = (
        MakeUpInvite.objects.select_for_update()
        .select_related("absence_record", "makeup_lesson")
        .filter(token=token)
        .first()
    )
    if invite is None:
        return {"ok": False, "code": "not-found"}

    if invite.used_at is not None:
        return {"ok": False, "code": "already-used", "request_id": invite.created_makeup_request_id}
    if invite.expires_at < timezone.now():
        return {"ok": False, "code": "expired"}

    existing = MakeUpRequest.objects.filter(
        absence_record=invite.absence_record,
        makeup_lesson=invite.makeup_lesson,
    ).first()
    if existing is None:
        existing = MakeUpRequest.objects.create(
            absence_record=invite.absence_record,
            makeup_lesson=invite.makeup_lesson,
            student=invite.absence_record.student,
        )

    invite.used_at = timezone.now()
    invite.created_makeup_request = existing
    invite.save(update_fields=["used_at", "created_makeup_request"])

    # Помечаем остальные invites этого absence как использованные (чтобы родитель не подтвердил ещё один)
    MakeUpInvite.objects.filter(
        absence_record=invite.absence_record,
        used_at__isnull=True,
    ).exclude(pk=invite.pk).update(used_at=timezone.now())

    return {"ok": True, "code": "confirmed", "request_id": existing.id}
