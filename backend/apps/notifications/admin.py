from django.contrib import admin

from .models import NotificationEvent, NotificationTemplate


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
