"""Сервисы аутентификации: сброс пароля по email, выдача одноразового пароля админом."""

import secrets
import string

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import PasswordResetToken, User


def generate_one_time_password(length: int = 10) -> str:
    """Сгенерировать читаемый одноразовый пароль (буквы+цифры, без неоднозначных символов)."""
    alphabet = string.ascii_letters + string.digits
    alphabet = alphabet.replace("0", "").replace("O", "").replace("o", "")
    alphabet = alphabet.replace("1", "").replace("l", "").replace("I", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def issue_admin_reset(user: User) -> str:
    """Выдать одноразовый пароль и пометить, что пользователь обязан его сменить."""
    new_password = generate_one_time_password()
    user.set_password(new_password)
    user.must_change_password = True
    user.save(update_fields=["password", "must_change_password"])
    return new_password


def request_password_reset(email: str, request=None) -> int:
    """Создать токен сброса пароля и отправить письмо. Возвращает количество писем."""
    if not email:
        return 0

    users = list(User.objects.filter(email__iexact=email.strip()))
    if not users:
        # Не палим, существует ли email; просто 0
        return 0

    sent = 0
    for user in users:
        token = PasswordResetToken.objects.create(user=user)
        reset_link = f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/reset-password/{token.token}"
        subject = "Восстановление пароля КиберШкола"
        message = (
            f"Здравствуйте, {user.get_full_name() or user.username}!\n\n"
            f"Вы запросили восстановление пароля. Чтобы задать новый пароль, перейдите по ссылке:\n"
            f"{reset_link}\n\n"
            f"Ссылка действительна {PasswordResetToken.TTL_HOURS} часа. "
            f"Если вы не запрашивали сброс — просто проигнорируйте это письмо."
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email.lower()],
            fail_silently=True,
        )
        sent += 1
    return sent


def confirm_password_reset(token_value: str, new_password: str) -> User:
    """Проверить токен, установить новый пароль. Бросает ValueError при ошибке."""
    token = PasswordResetToken.objects.filter(token=token_value).select_related("user").first()
    if not token:
        raise ValueError("Ссылка недействительна или уже использована.")
    if not token.is_valid:
        raise ValueError("Срок действия ссылки истёк или она уже использовалась.")
    if not new_password or len(new_password) < 8:
        raise ValueError("Пароль должен быть не короче 8 символов.")

    user = token.user
    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])

    token.used_at = timezone.now()
    token.save(update_fields=["used_at"])

    # Инвалидируем все остальные токены этого пользователя
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).exclude(id=token.id).update(
        used_at=timezone.now()
    )

    return user
