from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="weekly_lesson_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="group",
            name="weekly_lesson_weekday",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
