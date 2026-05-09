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
            "homework",
            "attendance_records",
        ]

    def get_attendance_records(self, obj):
        records = obj.attendance_records.all().values(
            "student_id", "status", "grade", "teacher_comment"
        )
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
    homework = serializers.CharField(allow_blank=True, required=False)
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

            grade = row.get("grade")
            if grade in ("", None):
                grade = None
            else:
                try:
                    grade = int(grade)
                except (TypeError, ValueError):
                    raise serializers.ValidationError("Оценка должна быть числом от 1 до 5")
                if grade < 1 or grade > 5:
                    raise serializers.ValidationError("Оценка должна быть числом от 1 до 5")

            comment = (row.get("teacher_comment") or "").strip()

            validated.append({
                "student_id": int(student_id),
                "status": status,
                "grade": grade,
                "teacher_comment": comment,
            })

        return validated

    def save(self, **kwargs):
        lesson = self.context["lesson"]
        topic = self.validated_data.get("topic", "").strip()
        description = self.validated_data.get("description", "").strip()
        homework = (self.validated_data.get("homework") or "").strip()

        lesson.conducted_topic = topic
        lesson.conducted_description = description
        lesson.homework = homework
        lesson.save(update_fields=["conducted_topic", "conducted_description", "homework"])

        results = []
        for row in self.validated_data["attendance"]:
            mark_serializer = AttendanceMarkSerializer(
                data={
                    "lesson_id": lesson.id,
                    "student_id": row["student_id"],
                    "status": row["status"],
                    "grade": row["grade"],
                    "teacher_comment": row["teacher_comment"],
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
                    "grade": record.grade,
                    "teacher_comment": record.teacher_comment,
                }
            )

        return {"lesson_id": lesson.id, "attendance": results, "homework": lesson.homework}


class AttendanceMarkSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()
    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
    makeup_request_id = serializers.IntegerField(required=False)
    grade = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)
    teacher_comment = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        lesson = Lesson.objects.get(id=self.validated_data["lesson_id"])
        student_id = self.validated_data["student_id"]
        status = self.validated_data["status"]
        makeup_request_id = self.validated_data.get("makeup_request_id")
        grade = self.validated_data.get("grade")
        teacher_comment = self.validated_data.get("teacher_comment", "")

        previous_record = AttendanceRecord.objects.filter(lesson=lesson, student_id=student_id).first()
        previous_status = previous_record.status if previous_record else None

        defaults = {"status": status, "teacher_comment": teacher_comment}
        if "grade" in self.validated_data:
            defaults["grade"] = grade

        record, _ = AttendanceRecord.objects.update_or_create(
            lesson=lesson,
            student_id=student_id,
            defaults=defaults,
        )

        if status == AttendanceRecord.Status.PRESENT and not record.charged:
            if charge_one_lesson(student_id):
                record.charged = True
                record.save(update_fields=["charged"])

        if status == AttendanceRecord.Status.MAKEUP:
            request_obj = None
            if makeup_request_id:
                request_obj = MakeUpRequest.objects.filter(id=makeup_request_id).first()
            if not request_obj:
                request_obj = (
                    MakeUpRequest.objects.filter(
                        student_id=student_id,
                        makeup_lesson=lesson,
                        status=MakeUpRequest.Status.REQUESTED,
                    )
                    .order_by("created_at")
                    .first()
                )

            if request_obj:
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


class MakeUpRequestSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source="student_id", read_only=True)
    absence_record_id = serializers.IntegerField(source="absence_record_id", read_only=True)
    student_name = serializers.SerializerMethodField()
    absence_lesson_id = serializers.SerializerMethodField()
    absence_starts_at = serializers.SerializerMethodField()
    absence_group_name = serializers.SerializerMethodField()
    makeup_lesson_id = serializers.SerializerMethodField()
    makeup_starts_at = serializers.SerializerMethodField()
    makeup_group_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MakeUpRequest
        fields = [
            "id",
            "status",
            "created_at",
            "approved_at",
            "student_id",
            "student_name",
            "absence_record_id",
            "absence_lesson_id",
            "absence_starts_at",
            "absence_group_name",
            "makeup_lesson_id",
            "makeup_starts_at",
            "makeup_group_name",
            "approved_by_name",
        ]

    def get_student_name(self, obj):
        student = obj.student
        if not student:
            return ""
        return student.get_full_name().strip() or student.username or f"ID {student.id}"

    def get_absence_lesson_id(self, obj):
        return obj.absence_record.lesson_id if obj.absence_record else None

    def get_absence_starts_at(self, obj):
        if not obj.absence_record or not obj.absence_record.lesson:
            return None
        return obj.absence_record.lesson.starts_at

    def get_absence_group_name(self, obj):
        if not obj.absence_record or not obj.absence_record.lesson or not obj.absence_record.lesson.group:
            return ""
        return obj.absence_record.lesson.group.name

    def get_makeup_lesson_id(self, obj):
        return obj.makeup_lesson_id

    def get_makeup_starts_at(self, obj):
        if not obj.makeup_lesson:
            return None
        return obj.makeup_lesson.starts_at

    def get_makeup_group_name(self, obj):
        if not obj.makeup_lesson or not obj.makeup_lesson.group:
            return ""
        return obj.makeup_lesson.group.name

    def get_approved_by_name(self, obj):
        approver = obj.approved_by
        if not approver:
            return ""
        return approver.get_full_name().strip() or approver.username or f"ID {approver.id}"
