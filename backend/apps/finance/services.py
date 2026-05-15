import json
import os
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from .models import Payment, PaymentIntent, Subscription


_DEFAULT_PLANS = {
    "month":     {"amount": "12000.00",  "lessons": 0, "duration_months": 1,  "label": "1 месяц"},
    "half_year": {"amount": "66000.00",  "lessons": 0, "duration_months": 6,  "label": "6 месяцев"},
    "year":      {"amount": "120000.00", "lessons": 0, "duration_months": 12, "label": "12 месяцев"},
}

_PLANS_FILE = Path(__file__).resolve().parent.parent.parent / "pricing_plans.json"


def _load_plans_raw():
    """Загрузить тарифы из JSON-файла, или вернуть дефолтные."""
    if _PLANS_FILE.exists():
        try:
            with open(_PLANS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_PLANS)


def get_payment_plans():
    """Вернуть тарифы в формате {plan_code: {amount, lessons, duration_months, label}}."""
    raw = _load_plans_raw()
    result = {}
    for code, data in raw.items():
        result[code] = {
            "amount": Decimal(str(data["amount"])),
            "lessons": int(data.get("lessons", 0)),
            "duration_months": int(data.get("duration_months", 1)),
            "label": str(data.get("label", code)),
        }
    return result


def save_payment_plans(plans_dict):
    """Сохранить тарифы в JSON-файл. plans_dict: {code: {amount, duration_months, label, ...}}."""
    serializable = {}
    for code, data in plans_dict.items():
        serializable[code] = {
            "amount": str(data["amount"]),
            "lessons": int(data.get("lessons", 0)),
            "duration_months": int(data.get("duration_months", 1)),
            "label": str(data.get("label", code)),
        }
    with open(_PLANS_FILE, "w", encoding="utf-8") as f:
        json.dump(serializable, f, ensure_ascii=False, indent=2)


# Обратная совместимость — PAYMENT_PLANS теперь свойство-функция
PAYMENT_PLANS = get_payment_plans()

AUTO_PROCESS_DELAY_SECONDS = 5


@transaction.atomic
def charge_one_lesson(student_id: int) -> bool:
    """
    Проверить, что у ученика есть активная подписка, покрывающая текущую дату.
    Период-based: если valid_from/valid_until заданы — проверяем дату.
    Legacy (lessons-based): если valid_from не задан — декрементируем remaining_lessons.
    """
    from datetime import date

    today = date.today()

    # Сначала проверяем подписку по периоду
    period_sub = (
        Subscription.objects.select_for_update()
        .filter(
            student_id=student_id,
            is_active=True,
            valid_from__isnull=False,
            valid_from__lte=today,
            valid_until__gte=today,
        )
        .first()
    )
    if period_sub:
        return True

    # Fallback: legacy lesson-count подписка
    lesson_sub = (
        Subscription.objects.select_for_update()
        .filter(student_id=student_id, is_active=True, remaining_lessons__gt=0, valid_from__isnull=True)
        .order_by("created_at")
        .first()
    )
    if lesson_sub:
        lesson_sub.remaining_lessons -= 1
        lesson_sub.save(update_fields=["remaining_lessons"])
        return True

    return False


@transaction.atomic
def process_pending_payment_intents():
    threshold = timezone.now() - timedelta(seconds=AUTO_PROCESS_DELAY_SECONDS)
    intents = (
        PaymentIntent.objects.select_for_update()
        .filter(status=PaymentIntent.Status.PENDING, created_at__lte=threshold)
        .order_by("id")
    )

    processed_count = 0
    for intent in intents:
        from datetime import date
        from dateutil.relativedelta import relativedelta

        plan_data = get_payment_plans().get(intent.plan, {})
        duration_months = plan_data.get("duration_months", 0)

        # Деактивируем предыдущую подписку
        Subscription.objects.filter(student=intent.student, is_active=True).update(is_active=False)

        today = date.today()
        if duration_months > 0:
            subscription = Subscription.objects.create(
                student=intent.student,
                total_lessons=0,
                remaining_lessons=0,
                valid_from=today,
                valid_until=today + relativedelta(months=duration_months) - timedelta(days=1),
                is_active=True,
            )
        else:
            subscription = Subscription.objects.create(
                student=intent.student,
                total_lessons=intent.lessons,
                remaining_lessons=intent.lessons,
                is_active=True,
            )

        Payment.objects.create(subscription=subscription, amount=intent.amount)

        intent.status = PaymentIntent.Status.PAID
        intent.processed_at = timezone.now()
        intent.error_message = ""
        intent.save(update_fields=["status", "processed_at", "error_message", "updated_at"])
        processed_count += 1

    return processed_count


@transaction.atomic
def create_admin_payment(student_id: int, plan: str) -> PaymentIntent:
    """Create and immediately process a payment intent (for cash/offline payments)"""
    from datetime import date
    from dateutil.relativedelta import relativedelta
    from django.contrib.auth import get_user_model

    User = get_user_model()
    student = User.objects.get(id=student_id)

    plan_data = get_payment_plans().get(plan)
    if not plan_data:
        raise ValueError(f"Invalid plan: {plan}")

    duration_months = plan_data.get("duration_months", 0)
    today = date.today()

    # Деактивируем предыдущую подписку
    Subscription.objects.filter(student=student, is_active=True).update(is_active=False)

    if duration_months > 0:
        # Period-based подписка
        valid_from = today
        valid_until = today + relativedelta(months=duration_months) - timedelta(days=1)
        subscription = Subscription.objects.create(
            student=student,
            total_lessons=0,
            remaining_lessons=0,
            valid_from=valid_from,
            valid_until=valid_until,
            is_active=True,
        )
    else:
        # Legacy: lesson-count подписка
        subscription = Subscription.objects.create(
            student=student,
            total_lessons=plan_data["lessons"],
            remaining_lessons=plan_data["lessons"],
            is_active=True,
        )

    # Create payment record
    Payment.objects.create(subscription=subscription, amount=plan_data["amount"])

    # Create already-processed payment intent for audit trail
    intent = PaymentIntent.objects.create(
        student=student,
        parent=None,
        plan=plan,
        amount=plan_data["amount"],
        lessons=plan_data.get("lessons", 0),
        status=PaymentIntent.Status.PAID,
        processed_at=timezone.now(),
    )

    return intent
