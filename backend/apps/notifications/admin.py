from django.contrib import admin

from .models import NotificationEvent, NotificationTemplate, TelegramLinkToken


@admin.register(NotificationEvent)
class NotificationEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "status", "student", "parent", "created_at")
    list_filter = ("event_type", "status", "created_at")
    search_fields = ("student__username", "student__email", "parent__username", "message")


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("event_type", "title", "is_active", "updated_at")
    list_filter = ("event_type", "is_active")
    search_fields = ("title", "body")


@admin.register(TelegramLinkToken)
class TelegramLinkTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "used_at")
    list_filter = ("used_at", "created_at")
    search_fields = ("user__username", "user__email", "token")
    readonly_fields = ("token", "created_at", "used_at")
