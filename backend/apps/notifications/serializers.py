from rest_framework import serializers

from .models import NotificationEvent


class NotificationEventSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    parent_name = serializers.SerializerMethodField()

    class Meta:
        model = NotificationEvent
        fields = [
            "id",
            "event_type",
            "status",
            "student",
            "student_name",
            "parent",
            "parent_name",
            "message",
            "created_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username

    def get_parent_name(self, obj):
        if not obj.parent:
            return None
        full_name = obj.parent.get_full_name().strip()
        return full_name or obj.parent.username
