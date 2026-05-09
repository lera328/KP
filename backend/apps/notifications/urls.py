from django.urls import path

from .views import notification_events_view, send_payment_reminders_view

urlpatterns = [
    path("payment-reminders/", send_payment_reminders_view, name="send-payment-reminders"),
    path("events/", notification_events_view, name="notification-events"),
]
