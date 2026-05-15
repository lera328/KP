"""FR-09 — расчёт риска оттока учеников.

Возвращает по каждому ученику набор метрик и итоговый уровень риска (low/medium/high)
с расшифровкой причин (reasons), чтобы админ мог быстро понять, на кого обратить внимание.
"""

from datetime import timedelta

from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.finance.models import Subscription

from .models import Role, User

# Параметры алгоритма (могут потом стать настройками в админке)
WINDOW_DAYS = 30
HIGH_CONSECUTIVE_ABSENCES = 3
MEDIUM_CONSECUTIVE_ABSENCES = 2
LOW_ATTENDANCE_RATE = 0.6  # < 60% за 30 дней — повод для тревоги
STALE_LAST_LESSON_DAYS = 21


def _compute_consecutive_absences(records) -> int:
    """records — итерируется в порядке от самого нового к старому."""
    streak = 0
    for record in records:
        if record.status == AttendanceRecord.Status.ABSENT:
            streak += 1
        else:
            break
    return streak


def _student_payload(student: User) -> dict:
    now = timezone.now()
    window_start = now - timedelta(days=WINDOW_DAYS)

    records_qs = (
        AttendanceRecord.objects
        .filter(student=student)
        .select_related("lesson", "lesson__group")
        .order_by("-lesson__starts_at", "-id")
    )
    recent_records = list(records_qs[:50])

    consecutive_absences = _compute_consecutive_absences(recent_records)

    window_records = [r for r in recent_records if r.lesson.starts_at >= window_start]
    window_total = len(window_records)
    window_absent = sum(1 for r in window_records if r.status == AttendanceRecord.Status.ABSENT)
    attendance_rate_30d = None
    if window_total:
        attendance_rate_30d = round((window_total - window_absent) / window_total, 2)

    last_record = recent_records[0] if recent_records else None
    last_lesson_at = last_record.lesson.starts_at if last_record else None

    subscription = (
        Subscription.objects
        .filter(student=student, is_active=True)
        .order_by("-created_at")
        .first()
    )
    has_active_subscription = bool(subscription)
    remaining_lessons = subscription.remaining_lessons if subscription else 0
    valid_until = subscription.valid_until if subscription else None
    is_period_based = subscription and subscription.valid_from is not None

    group = last_record.lesson.group.name if last_record else ""

    reasons: list[str] = []
    risk_score = 0  # 0 low, 1 medium, 2 high

    if consecutive_absences >= HIGH_CONSECUTIVE_ABSENCES:
        risk_score = max(risk_score, 2)
        reasons.append(f"{consecutive_absences} пропусков подряд")
    elif consecutive_absences >= MEDIUM_CONSECUTIVE_ABSENCES:
        risk_score = max(risk_score, 1)
        reasons.append(f"{consecutive_absences} пропуска подряд")

    if not has_active_subscription:
        if window_absent or consecutive_absences:
            risk_score = max(risk_score, 2)
            reasons.append("Не оплачены занятия и есть пропуски")
        else:
            risk_score = max(risk_score, 1)
            reasons.append("Не оплачены занятия")
    elif is_period_based:
        from datetime import date
        days_left = (valid_until - date.today()).days if valid_until else 0
        if days_left <= 0:
            risk_score = max(risk_score, 1)
            reasons.append("Абонемент истёк")
        elif days_left <= 7:
            risk_score = max(risk_score, 1)
            reasons.append(f"Абонемент истекает через {days_left} дн.")
    elif remaining_lessons == 0:
        risk_score = max(risk_score, 1)
        reasons.append("Закончились оплаченные занятия")

    if attendance_rate_30d is not None and attendance_rate_30d < LOW_ATTENDANCE_RATE:
        risk_score = max(risk_score, 1)
        reasons.append(
            f"Посещаемость за 30 дней {int(attendance_rate_30d * 100)}%"
        )

    if last_lesson_at and (now - last_lesson_at).days >= STALE_LAST_LESSON_DAYS:
        risk_score = max(risk_score, 1)
        reasons.append(
            f"Последний урок {(now - last_lesson_at).days} дн. назад"
        )

    risk_level = ["low", "medium", "high"][risk_score]

    return {
        "student_id": student.id,
        "student_name": student.get_full_name().strip() or student.username,
        "username": student.username,
        "email": student.email,
        "group_name": group,
        "consecutive_absences": consecutive_absences,
        "attendance_rate_30d": attendance_rate_30d,
        "lessons_in_window": window_total,
        "absences_in_window": window_absent,
        "remaining_lessons": remaining_lessons,
        "valid_until": str(valid_until) if valid_until else None,
        "has_active_subscription": has_active_subscription,
        "last_lesson_at": last_lesson_at,
        "risk_level": risk_level,
        "reasons": reasons,
    }


def compute_churn_report() -> list[dict]:
    """Собрать отчёт по всем активным ученикам, отсортированный по убыванию риска."""
    students = (
        User.objects
        .filter(is_active=True, roles__code=Role.Code.STUDENT)
        .distinct()
        .order_by("last_name", "first_name", "username")
    )

    rows = [_student_payload(s) for s in students]
    order = {"high": 0, "medium": 1, "low": 2}
    rows.sort(key=lambda r: (order[r["risk_level"]], -r["consecutive_absences"], r["student_name"]))
    return rows
