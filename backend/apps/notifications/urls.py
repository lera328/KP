from django.urls import path

from .views import send_payment_reminders_view

urlpatterns = [
    path("payment-reminders/", send_payment_reminders_view, name="send-payment-reminders"),
]
