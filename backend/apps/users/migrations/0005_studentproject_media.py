from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0004_studentproject'),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentProjectImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='projects/%Y/%m/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='users.studentproject')),
            ],
        ),
        migrations.CreateModel(
            name='StudentProjectLike',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='likes', to='users.studentproject')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_likes', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name='studentprojectlike',
            constraint=models.UniqueConstraint(fields=('project', 'user'), name='unique_project_like'),
        ),
    ]
