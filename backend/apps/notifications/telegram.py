"""Логика Telegram-бота: deep-link привязка и обработка webhook.

Поток:
1. В кабинете пользователь жмёт «Подключить Telegram» → backend выпускает
   одноразовый токен `TelegramLinkToken` и отдаёт ссылку
   `https://t.me/<bot>?start=<token>`.
2. Пользователь открывает ссылку в Telegram, нажимает Start — Telegram
   присылает боту `/start <token>` через webhook.
3. Webhook находит токен, сохраняет `chat_id` в `User.telegram_chat_id`,
   помечает токен использованным и отвечает приветствием.
"""

import json
import logging
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from apps.users.models import User

from .models import TelegramLinkToken

logger = logging.getLogger(__name__)


def _api_call(method: str, payload: dict) -> dict:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is empty"}
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = urlencode(payload).encode("utf-8")
    req = Request(url, data=data, method="POST")
    try:
        with urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8")
        return json.loads(body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Telegram API call failed: method=%s err=%s", method, exc)
        return {"ok": False, "error": str(exc)}


def send_message(chat_id: str, text: str) -> dict:
    return _api_call("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML"})


def issue_link_token(user: User) -> TelegramLinkToken:
    """Выдать новый токен. Старые неиспользованные оставляем — у них свой TTL."""
    return TelegramLinkToken.objects.create(user=user)


def build_deep_link(token: str) -> str:
    bot_username = (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@")
    if not bot_username:
        return ""
    return f"https://t.me/{bot_username}?start={token}"


def handle_update(update: dict) -> None:
    """Обработка одного апдейта от Telegram (webhook payload)."""
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return
    chat_id_str = str(chat_id)

    text = (message.get("text") or "").strip()
    if not text:
        return

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else ""
        _handle_start(chat_id_str, token, message)
        return

    if text.startswith("/unlink"):
        _handle_unlink(chat_id_str)
        return

    if text.startswith("/help"):
        send_message(
            chat_id_str,
            "Доступные команды:\n/start &lt;token&gt; — привязать аккаунт\n/unlink — отвязать аккаунт",
        )
        return


def _handle_start(chat_id: str, token: str, message: dict) -> None:
    if not token:
        send_message(
            chat_id,
            (
                "Здравствуйте! Чтобы получать уведомления, откройте свой кабинет "
                "КиберШколы и нажмите кнопку «Подключить Telegram»."
            ),
        )
        return

    link = TelegramLinkToken.objects.filter(token=token).select_related("user").first()
    if not link or not link.is_valid():
        send_message(
            chat_id,
            "Ссылка недействительна или устарела. Сгенерируйте новую в кабинете.",
        )
        return

    user = link.user
    user.telegram_chat_id = chat_id
    user.save(update_fields=["telegram_chat_id"])

    link.used_at = timezone.now()
    link.save(update_fields=["used_at"])

    full_name = user.get_full_name().strip() or user.username
    send_message(
        chat_id,
        f"✅ Аккаунт <b>{full_name}</b> успешно привязан. Вы будете получать уведомления здесь.",
    )


def _handle_unlink(chat_id: str) -> None:
    users = list(User.objects.filter(telegram_chat_id=chat_id))
    if not users:
        send_message(chat_id, "Этот чат не привязан ни к одному аккаунту.")
        return
    for user in users:
        user.telegram_chat_id = ""
        user.save(update_fields=["telegram_chat_id"])
    send_message(chat_id, "Аккаунт отвязан. Уведомления приходить не будут.")
