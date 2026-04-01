# Generated migration for finance app updates

from django.db import migrations, models
import django.db.models.expressions


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddConstraint(
            model_name='subscription',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_active', True)),
                fields=('student',),
                name='unique_active_subscription_per_student'
            ),
        ),
    ]
