from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Payment, PaymentIntent, Subscription


PAYMENT_PLANS = {
    PaymentIntent.Plan.MONTH: {"amount": Decimal("12000.00"), "lessons": 8, "label": "1 месяц"},
    PaymentIntent.Plan.HALF_YEAR: {"amount": Decimal("66000.00"), "lessons": 48, "label": "6 месяцев"},
    PaymentIntent.Plan.YEAR: {"amount": Decimal("120000.00"), "lessons": 96, "label": "12 месяцев"},
}

AUTO_PROCESS_DELAY_SECONDS = 5


@transaction.atomic
def charge_one_lesson(student_id: int) -> bool:
    subscription = (
        Subscription.objects.select_for_update()
        .filter(student_id=student_id, is_active=True, remaining_lessons__gt=0)
        .order_by("created_at")
        .first()
    )
    if not subscription:
        return False

    subscription.remaining_lessons -= 1
    subscription.save(update_fields=["remaining_lessons"])
    return True


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
        subscription = (
            Subscription.objects.select_for_update()
            .filter(student=intent.student, is_active=True)
            .first()
        )

        if subscription is None:
            subscription = Subscription.objects.create(
                student=intent.student,
                total_lessons=intent.lessons,
                remaining_lessons=intent.lessons,
                is_active=True,
            )
        else:
            subscription.total_lessons += intent.lessons
            subscription.remaining_lessons += intent.lessons
            subscription.save(update_fields=["total_lessons", "remaining_lessons", "updated_at"])

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
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    student = User.objects.get(id=student_id)
    
    plan_data = PAYMENT_PLANS.get(plan)
    if not plan_data:
        raise ValueError(f"Invalid plan: {plan}")
    
    # Get or create active subscription
    subscription = (
        Subscription.objects.select_for_update()
        .filter(student=student, is_active=True)
        .first()
    )
    
    if subscription is None:
        subscription = Subscription.objects.create(
            student=student,
            total_lessons=plan_data["lessons"],
            remaining_lessons=plan_data["lessons"],
            is_active=True,
        )
    else:
        subscription.total_lessons += plan_data["lessons"]
        subscription.remaining_lessons += plan_data["lessons"]
        subscription.save(update_fields=["total_lessons", "remaining_lessons", "updated_at"])
    
    # Create payment record
    Payment.objects.create(subscription=subscription, amount=plan_data["amount"])
    
    # Create already-processed payment intent for audit trail
    intent = PaymentIntent.objects.create(
        student=student,
        parent=None,
        plan=plan,
        amount=plan_data["amount"],
        lessons=plan_data["lessons"],
        status=PaymentIntent.Status.PAID,
        processed_at=timezone.now(),
    )
    
    return intent
