import json
import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdminRole

from .models import NotificationEvent
from .serializers import NotificationEventSerializer
from .services import send_low_balance_payment_reminders
from .telegram import build_deep_link, handle_update, issue_link_token, send_message

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def send_payment_reminders_view(request):
    threshold = request.data.get("threshold")
    if threshold is not None:
        try:
            threshold = int(threshold)
        except ValueError:
            return Response({"error": "threshold must be integer"}, status=status.HTTP_400_BAD_REQUEST)

    result = send_low_balance_payment_reminders(threshold=threshold)
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminRole])
def notification_events_view(request):
    events = NotificationEvent.objects.select_related("student", "parent").order_by("-created_at")[:200]
    serializer = NotificationEventSerializer(events, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def telegram_status_view(request):
    """Статус привязки Telegram текущего пользователя."""
    user = request.user
    return Response(
        {
            "linked": bool(user.telegram_chat_id),
            "chat_id": user.telegram_chat_id or "",
            "bot_username": (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@"),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def telegram_link_view(request):
    """Выпустить deep-link для привязки Telegram."""
    if not settings.TELEGRAM_BOT_USERNAME:
        return Response(
            {"error": "TELEGRAM_BOT_USERNAME is not configured"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    token_obj = issue_link_token(request.user)
    return Response(
        {
            "token": token_obj.token,
            "deep_link": build_deep_link(token_obj.token),
            "expires_in_hours": token_obj.TTL_HOURS,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def telegram_unlink_view(request):
    """Отвязать Telegram-аккаунт текущего пользователя."""
    user = request.user
    if user.telegram_chat_id:
        user.telegram_chat_id = ""
        user.save(update_fields=["telegram_chat_id"])
    return Response({"linked": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def telegram_test_view(request):
    """Отправить тестовое сообщение в привязанный Telegram."""
    user = request.user
    if not user.telegram_chat_id:
        return Response(
            {"error": "Telegram не привязан"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    result = send_message(
        user.telegram_chat_id,
        "🔔 Тестовое уведомление от КиберШколы. Если вы видите это сообщение — всё работает.",
    )
    return Response({"ok": bool(result.get("ok")), "result": result})


@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_webhook_view(request, secret):
    """Webhook от Telegram. Проверяем секрет в URL — простая защита."""
    expected = settings.TELEGRAM_WEBHOOK_SECRET
    if not expected or secret != expected:
        return Response({"ok": False}, status=status.HTTP_403_FORBIDDEN)

    try:
        update = request.data if isinstance(request.data, dict) else json.loads(request.body or "{}")
    except (ValueError, json.JSONDecodeError):
        update = {}

    try:
        handle_update(update)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Telegram webhook handler error: %s", exc)

    # Telegram ждёт 200 OK максимально быстро.
    return Response({"ok": True})
