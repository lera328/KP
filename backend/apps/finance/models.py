from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Subscription(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    total_lessons = models.PositiveIntegerField(default=0)
    remaining_lessons = models.IntegerField(default=0)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['student'],
                condition=models.Q(is_active=True),
                name='unique_active_subscription_per_student'
            )
        ]

    def clean(self):
        if self.is_active:
            # Check if student already has active subscription (excluding self on update)
            existing = Subscription.objects.filter(
                student=self.student,
                is_active=True
            ).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError("Student already has an active subscription.")

    def __str__(self):
        return f"Subscription #{self.id} ({self.student_id})"


class Payment(models.Model):
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment #{self.id}"


class PaymentIntent(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает"
        PAID = "paid", "Оплачен"
        FAILED = "failed", "Ошибка"

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_intents")
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_payment_intents",
    )
    plan = models.CharField(max_length=32)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    lessons = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PaymentIntent #{self.id} ({self.student_id})"
