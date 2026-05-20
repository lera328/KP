from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0005_remaining_lessons_allow_negative"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentintent",
            name="plan",
            field=models.CharField(max_length=32),
        ),
    ]
