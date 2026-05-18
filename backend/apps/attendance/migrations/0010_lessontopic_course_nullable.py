import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0009_alter_lesson_topic"),
        ("courses", "0007_group_course_nullable"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lessontopic",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="topics",
                to="courses.course",
            ),
        ),
    ]
