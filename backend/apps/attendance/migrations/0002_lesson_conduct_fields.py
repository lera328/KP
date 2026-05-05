from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="conducted_description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="lesson",
            name="conducted_topic",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
