import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0006_groupcomment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="group",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="groups",
                to="courses.course",
            ),
        ),
    ]
