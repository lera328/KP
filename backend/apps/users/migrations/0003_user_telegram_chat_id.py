from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_seed_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="telegram_chat_id",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
