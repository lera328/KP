from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("courses", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonTopic",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="topics", to="courses.course")),
            ],
        ),
        migrations.CreateModel(
            name="Lesson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("starts_at", models.DateTimeField()),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lessons", to="courses.group")),
                ("teacher", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="taught_lessons", to=settings.AUTH_USER_MODEL)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="lessons", to="attendance.lessontopic")),
            ],
        ),
        migrations.CreateModel(
            name="AttendanceRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("present", "Присутствовал"), ("absent", "Пропуск"), ("makeup", "Отработка")], max_length=16)),
                ("charged", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="attendance.lesson")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("lesson", "student")}},
        ),
        migrations.CreateModel(
            name="MakeUpRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("requested", "Запрошена"), ("completed", "Проведена"), ("approved", "Подтверждена администратором")], default="requested", max_length=16)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("absence_record", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="makeup_requests", to="attendance.attendancerecord")),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_makeups", to=settings.AUTH_USER_MODEL)),
                ("completed_record", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="completed_makeup_request", to="attendance.attendancerecord")),
                ("makeup_lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="makeup_requests", to="attendance.lesson")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="makeup_requests", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
