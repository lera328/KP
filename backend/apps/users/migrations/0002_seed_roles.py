from django.db import migrations


def seed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    roles = [
        ("admin", "Администратор"),
        ("teacher", "Преподаватель"),
        ("parent", "Родитель"),
        ("student", "Ученик"),
    ]
    for code, name in roles:
        Role.objects.get_or_create(code=code, defaults={"name": name})


def unseed_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    Role.objects.filter(code__in=["admin", "teacher", "parent", "student"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
