"""Регистрирует webhook у Telegram-бота.

Использование:
    python manage.py set_telegram_webhook --base-url https://kiberschool.ru

Можно также передать --base-url через переменную окружения PUBLIC_FRONTEND_URL
(тогда параметр опционален).
"""

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Register Telegram bot webhook URL"

    def add_arguments(self, parser):
        parser.add_argument(
            "--base-url",
            help="Base URL of the site (например, https://kiberschool.ru). "
                 "По умолчанию берётся из settings.PUBLIC_FRONTEND_URL.",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Удалить webhook вместо установки.",
        )

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            raise CommandError("TELEGRAM_BOT_TOKEN is empty")

        if options["delete"]:
            self._call(token, "deleteWebhook", {})
            return

        secret = settings.TELEGRAM_WEBHOOK_SECRET
        if not secret:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET is empty")

        base = options.get("base_url") or settings.PUBLIC_FRONTEND_URL
        base = (base or "").rstrip("/")
        if not base.startswith("https://"):
            raise CommandError(
                f"Telegram требует HTTPS. Получено base_url={base!r}. "
                "Передайте --base-url https://your-domain"
            )

        webhook_url = f"{base}/api/notifications/telegram/webhook/{secret}/"
        self.stdout.write(f"Setting webhook: {webhook_url}")

        result = self._call(
            token,
            "setWebhook",
            {
                "url": webhook_url,
                "allowed_updates": json.dumps(["message", "edited_message"]),
                "drop_pending_updates": "true",
            },
        )
        if not result.get("ok"):
            raise CommandError(f"Telegram returned: {result}")

        info = self._call(token, "getWebhookInfo", {})
        self.stdout.write(self.style.SUCCESS(f"OK. getWebhookInfo: {json.dumps(info, ensure_ascii=False)}"))

    def _call(self, token: str, method: str, payload: dict) -> dict:
        url = f"https://api.telegram.org/bot{token}/{method}"
        data = urlencode(payload).encode("utf-8") if payload else None
        req = Request(url, data=data, method="POST" if data else "GET")
        with urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8")
        result = json.loads(body)
        self.stdout.write(f"{method} -> {body}")
        return result
