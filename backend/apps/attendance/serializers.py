from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers

from apps.finance.services import charge_one_lesson
from apps.notifications.services import notify_parents_about_absence, notify_parents_about_makeup_approval
from apps.courses.models import Group
from apps.users.models import User

from .models import AttendanceRecord, Lesson, LessonTopic, MakeUpRequest


class LessonTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonTopic
        fields = ["id", "course", "title"]


class LessonSerializer(serializers.ModelSerializer):
    attendance_records = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "group",
            "topic",
            "teacher",
            "starts_at",
            "is_extra",
            "is_makeup_slot",
            "conducted_topic",
            "conducted_description",
            "attendance_records",
        ]

    def get_attendance_records(self, obj):
        records = obj.attendance_records.all().values("student_id", "status")
        return list(records)


class GroupScheduleSetupSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    teacher_id = serializers.IntegerField()
    starts_at = serializers.DateTimeField()

    def validate(self, attrs):
        group = Group.objects.filter(id=attrs["group_id"]).first()
        teacher = User.objects.filter(id=attrs["teacher_id"]).first()

        if not group:
            raise serializers.ValidationError("Группа не найдена")
        if not teacher:
            raise serializers.ValidationError("Преподаватель не найден")

        starts_at_local = timezone.localtime(attrs["starts_at"])

        if group.weekly_lesson_weekday is not None and group.weekly_lesson_time is not None:
            existing_weekday = int(group.weekly_lesson_weekday)
            existing_time = group.weekly_lesson_time
            if (
                existing_weekday != starts_at_local.weekday()
                or existing_time.hour != starts_at_local.hour
                or existing_time.minute != starts_at_local.minute
            ):
                raise serializers.ValidationError(
                    "У группы уже зафиксирован другой стабильный слот. Изменение времени недоступно."
                )

        attrs["group"] = group
        attrs["teacher"] = teacher
        attrs["starts_at_local"] = starts_at_local
        return attrs


class ExtraLessonCreateSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    teacher_id = serializers.IntegerField()
    starts_at = serializers.DateTimeField()

    def validate(self, attrs):
        group = Group.objects.filter(id=attrs["group_id"]).first()
        teacher = User.objects.filter(id=attrs["teacher_id"]).first()

        if not group:
            raise serializers.ValidationError("Группа не найдена")
        if not teacher:
            raise serializers.ValidationError("Преподаватель не найден")

        starts_at = attrs["starts_at"]
        starts_at_local = timezone.localtime(starts_at)

        if Lesson.objects.filter(group=group, starts_at=starts_at).exists():
            raise serializers.ValidationError("У этой группы уже есть занятие в этот слот")

        if Lesson.objects.filter(teacher=teacher, starts_at=starts_at).exists():
            raise serializers.ValidationError("У преподавателя уже есть занятие в этот слот")

        if group.weekly_lesson_weekday is not None and group.weekly_lesson_time is not None:
            same_weekday = int(group.weekly_lesson_weekday) == starts_at_local.weekday()
            same_time = (
                group.weekly_lesson_time.hour == starts_at_local.hour
                and group.weekly_lesson_time.minute == starts_at_local.minute
            )
            if same_weekday and same_time:
                raise serializers.ValidationError("Этот слот уже занят регулярным занятием группы")

        attrs["group"] = group
        attrs["teacher"] = teacher
        return attrs


class LessonConductSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=255, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, required=False)
    attendance = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_attendance(self, value):
        validated = []
        for row in value:
            student_id = row.get("student_id")
            status = row.get("status")

            if not student_id or not status:
                raise serializers.ValidationError("Для каждой записи нужны student_id и status")

            if status not in AttendanceRecord.Status.values:
                raise serializers.ValidationError("Недопустимый статус посещаемости")

            validated.append({"student_id": int(student_id), "status": status})

        return validated

    def save(self, **kwargs):
        lesson = self.context["lesson"]
        topic = self.validated_data.get("topic", "").strip()
        description = self.validated_data.get("description", "").strip()

        lesson.conducted_topic = topic
        lesson.conducted_description = description
        lesson.save(update_fields=["conducted_topic", "conducted_description"])

        results = []
        for row in self.validated_data["attendance"]:
            mark_serializer = AttendanceMarkSerializer(
                data={
                    "lesson_id": lesson.id,
                    "student_id": row["student_id"],
                    "status": row["status"],
                }
            )
            mark_serializer.is_valid(raise_exception=True)
            record = mark_serializer.save()
            results.append(
                {
                    "id": record.id,
                    "student_id": record.student_id,
                    "status": record.status,
                    "charged": record.charged,
                }
            )

        return {"lesson_id": lesson.id, "attendance": results}


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
