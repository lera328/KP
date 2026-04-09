from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import ParentProfile, Role, StudentProfile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Дополнительно", {"fields": ("phone", "telegram_chat_id", "roles")}),)


admin.site.register(Role)
admin.site.register(StudentProfile)
admin.site.register(ParentProfile)
