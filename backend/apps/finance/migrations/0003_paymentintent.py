from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('finance', '0002_subscription_updates'),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentIntent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plan', models.CharField(choices=[('month', '1 месяц'), ('half_year', '6 месяцев'), ('year', '12 месяцев')], max_length=16)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('lessons', models.PositiveIntegerField()),
                ('status', models.CharField(choices=[('pending', 'Ожидает'), ('paid', 'Оплачен'), ('failed', 'Ошибка')], default='pending', max_length=16)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_payment_intents', to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_intents', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
