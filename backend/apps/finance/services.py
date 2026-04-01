from django.db import transaction

from .models import Subscription


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
