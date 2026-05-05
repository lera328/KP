from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0003_lesson_is_makeup_slot"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="is_extra",
            field=models.BooleanField(default=False),
        ),
    ]
