import uuid

from django.db import migrations, models


def assign_portfolio_tokens(apps, schema_editor):
    StudentProfile = apps.get_model("users", "StudentProfile")
    for profile in StudentProfile.objects.all():
        if not profile.portfolio_token:
            profile.portfolio_token = uuid.uuid4()
            profile.save(update_fields=["portfolio_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_alter_user_options_alter_user_managers_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentprofile",
            name="portfolio_token",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(assign_portfolio_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="studentprofile",
            name="portfolio_token",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
    ]
