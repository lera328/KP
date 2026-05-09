from django.db import migrations


SEED = [
    {"name": "Куйбышева", "address": ""},
    {"name": "Мира", "address": ""},
    {"name": "Карла Маркса", "address": ""},
]


def seed_locations(apps, schema_editor):
    Location = apps.get_model("courses", "Location")
    for item in SEED:
        Location.objects.get_or_create(name=item["name"], defaults={"address": item["address"]})


def unseed_locations(apps, schema_editor):
    Location = apps.get_model("courses", "Location")
    Location.objects.filter(name__in=[i["name"] for i in SEED]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0003_location"),
    ]

    operations = [
        migrations.RunPython(seed_locations, unseed_locations),
    ]
