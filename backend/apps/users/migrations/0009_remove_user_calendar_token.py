from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_user_must_change_password_calendar_token_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="calendar_token",
        ),
    ]
