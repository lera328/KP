from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0003_paymentintent"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="valid_from",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscription",
            name="valid_until",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="subscription",
            name="total_lessons",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="subscription",
            name="remaining_lessons",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
