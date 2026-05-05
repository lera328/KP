from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0002_lesson_conduct_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="is_makeup_slot",
            field=models.BooleanField(default=False),
        ),
    ]
