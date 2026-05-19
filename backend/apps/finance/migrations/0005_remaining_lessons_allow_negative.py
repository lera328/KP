from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0004_subscription_period_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subscription",
            name="remaining_lessons",
            field=models.IntegerField(default=0),
        ),
    ]
