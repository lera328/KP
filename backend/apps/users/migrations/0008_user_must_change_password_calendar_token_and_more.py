import uuid

from django.conf import settings
from django.db import migrations, models


def assign_calendar_tokens(apps, schema_editor):
    User = apps.get_model("users", "User")
    for user in User.objects.all():
        if not user.calendar_token:
            user.calendar_token = uuid.uuid4()
            user.save(update_fields=["calendar_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_studentprofile_portfolio_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="must_change_password",
            field=models.BooleanField(
                default=False,
                help_text="Пользователь обязан сменить пароль при следующем входе.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="calendar_token",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(assign_calendar_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="calendar_token",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
        migrations.CreateModel(
            name="PasswordResetToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="password_reset_tokens",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
