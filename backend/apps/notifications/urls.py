from django.urls import path

from .views import (
    notification_events_view,
    send_payment_reminders_view,
    telegram_link_view,
    telegram_status_view,
    telegram_test_view,
    telegram_unlink_view,
    telegram_webhook_view,
)

urlpatterns = [
    path("payment-reminders/", send_payment_reminders_view, name="send-payment-reminders"),
    path("events/", notification_events_view, name="notification-events"),
    path("telegram/status/", telegram_status_view, name="telegram-status"),
    path("telegram/link/", telegram_link_view, name="telegram-link"),
    path("telegram/unlink/", telegram_unlink_view, name="telegram-unlink"),
    path("telegram/test/", telegram_test_view, name="telegram-test"),
    path("telegram/webhook/<str:secret>/", telegram_webhook_view, name="telegram-webhook"),
]
