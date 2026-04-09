from django.utils import timezone
from rest_framework import serializers

from apps.finance.services import charge_one_lesson
from apps.notifications.services import notify_parents_about_absence, notify_parents_about_makeup_approval

from .models import AttendanceRecord, Lesson, LessonTopic, MakeUpRequest


class LessonTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonTopic
        fields = ["id", "course", "title"]


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "group", "topic", "teacher", "starts_at"]


class AttendanceMarkSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()
    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
    makeup_request_id = serializers.IntegerField(required=False)

    def save(self, **kwargs):
        lesson = Lesson.objects.get(id=self.validated_data["lesson_id"])
        student_id = self.validated_data["student_id"]
        status = self.validated_data["status"]

        previous_record = AttendanceRecord.objects.filter(lesson=lesson, student_id=student_id).first()
        previous_status = previous_record.status if previous_record else None

        record, _ = AttendanceRecord.objects.update_or_create(
            lesson=lesson,
            student_id=student_id,
            defaults={"status": status},
        )

        if status == AttendanceRecord.Status.PRESENT and not record.charged:
            if charge_one_lesson(student_id):
                record.charged = True
                record.save(update_fields=["charged"])

        if status == AttendanceRecord.Status.MAKEUP and self.validated_data.get("makeup_request_id"):
            request_obj = MakeUpRequest.objects.get(id=self.validated_data["makeup_request_id"])
            request_obj.completed_record = record
            request_obj.status = MakeUpRequest.Status.COMPLETED
            request_obj.save(update_fields=["completed_record", "status"])

        if status == AttendanceRecord.Status.ABSENT and previous_status != AttendanceRecord.Status.ABSENT:
            notify_parents_about_absence(record)

        return record


class MakeUpRequestCreateSerializer(serializers.Serializer):
    absence_record_id = serializers.IntegerField()
    makeup_lesson_id = serializers.IntegerField()

    def validate(self, attrs):
        absence = AttendanceRecord.objects.get(id=attrs["absence_record_id"])
        makeup_lesson = Lesson.objects.get(id=attrs["makeup_lesson_id"])

        if absence.status != AttendanceRecord.Status.ABSENT:
            raise serializers.ValidationError("Отработка создается только на основании пропуска")

        if absence.lesson.topic_id != makeup_lesson.topic_id:
            raise serializers.ValidationError("Отработка должна проходить по теме пропущенного занятия")

        attrs["absence"] = absence
        attrs["makeup_lesson"] = makeup_lesson
        return attrs

    def save(self, **kwargs):
        absence = self.validated_data["absence"]
        makeup_lesson = self.validated_data["makeup_lesson"]
        request_obj = MakeUpRequest.objects.create(
            absence_record=absence,
            makeup_lesson=makeup_lesson,
            student=absence.student,
        )
        return request_obj


class MakeUpApproveSerializer(serializers.Serializer):
    def save(self, request_obj, admin_user):
        old_status = request_obj.status

        if request_obj.status != MakeUpRequest.Status.COMPLETED:
            raise serializers.ValidationError("Сначала нужно зафиксировать факт отработки")

        request_obj.status = MakeUpRequest.Status.APPROVED
        request_obj.approved_by = admin_user
        request_obj.approved_at = timezone.now()
        request_obj.save(update_fields=["status", "approved_by", "approved_at"])

        completed = request_obj.completed_record
        if completed and not completed.charged:
            if charge_one_lesson(request_obj.student_id):
                completed.charged = True
                completed.save(update_fields=["charged"])

        if old_status != MakeUpRequest.Status.APPROVED:
            notify_parents_about_makeup_approval(request_obj)

        return request_obj
