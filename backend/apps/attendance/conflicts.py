"""Проверка пересечения занятий по времени и локации.

Длительности:
- Регулярное / разовое занятие — 120 минут.
- Слот отработки — 60 минут.
Конфликт: на одной локации интервалы [starts_at, starts_at + duration) пересекаются.
"""

from datetime import timedelta

from .models import Lesson


REGULAR_LESSON_DURATION = timedelta(minutes=120)
MAKEUP_SLOT_DURATION = timedelta(minutes=60)


def lesson_duration(is_makeup_slot: bool) -> timedelta:
    return MAKEUP_SLOT_DURATION if is_makeup_slot else REGULAR_LESSON_DURATION


def find_location_conflict(starts_at, location_id, *, is_makeup_slot=False, exclude_lesson_id=None):
    """Возвращает первый Lesson, чей интервал пересекается с новым, либо None."""
    if not starts_at or not location_id:
        return None
    new_duration = lesson_duration(is_makeup_slot)
    new_end = starts_at + new_duration
    # Кандидаты — всё, что начинается раньше new_end и не далее REGULAR window назад.
    candidates = Lesson.objects.filter(
        location_id=location_id,
        starts_at__lt=new_end,
        starts_at__gt=starts_at - REGULAR_LESSON_DURATION,
    )
    if exclude_lesson_id:
        candidates = candidates.exclude(id=exclude_lesson_id)
    candidates = candidates.select_related("group", "location", "teacher")
    for existing in candidates:
        existing_end = existing.starts_at + lesson_duration(existing.is_makeup_slot)
        if existing.starts_at < new_end and existing_end > starts_at:
            return existing
    return None


def describe_conflict(lesson) -> str:
    parts = [lesson.starts_at.strftime("%d.%m.%Y %H:%M")]
    if lesson.location_id:
        parts.append(f"локация «{lesson.location.name}»")
    if lesson.is_makeup_slot:
        parts.append("слот отработки")
    elif lesson.group_id:
        parts.append(f"группа «{lesson.group.name}»")
    return ", ".join(parts)
