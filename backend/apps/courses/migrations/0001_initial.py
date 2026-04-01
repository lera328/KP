from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Course",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
        ),
        migrations.CreateModel(
            name="Group",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="groups", to="courses.course")),
            ],
        ),
        migrations.CreateModel(
            name="GroupStudent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="courses.group")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("group", "user")}},
        ),
        migrations.CreateModel(
            name="GroupTeacher",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="courses.group")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("group", "user")}},
        ),
        migrations.AddField(
            model_name="group",
            name="students",
            field=models.ManyToManyField(blank=True, related_name="student_groups", through="courses.GroupStudent", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="group",
            name="teachers",
            field=models.ManyToManyField(blank=True, related_name="teacher_groups", through="courses.GroupTeacher", to=settings.AUTH_USER_MODEL),
        ),
    ]
