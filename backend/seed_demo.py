"""Полный сброс и насеивание демо-данных КиберШкола.

Запуск:
    docker compose exec -T backend python seed_demo.py
"""

from datetime import timedelta
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from django.db import transaction

from apps.users.models import (
    User,
    Role,
    StudentProfile,
    ParentProfile,
    PasswordResetToken,
    StudentProject,
    StudentProjectLike,
)
from apps.courses.models import Course, Group, GroupStudent, GroupTeacher, Location
from apps.attendance.models import (
    Lesson,
    LessonTopic,
    AttendanceRecord,
    MakeUpRequest,
    MakeUpInvite,
)
from apps.finance.models import Subscription


PASSWORD = "demo12345"


def wipe():
    print("→ Удаляю все данные…")
    MakeUpInvite.objects.all().delete()
    MakeUpRequest.objects.all().delete()
    AttendanceRecord.objects.all().delete()
    Lesson.objects.all().delete()
    GroupStudent.objects.all().delete()
    GroupTeacher.objects.all().delete()
    Group.objects.all().delete()
    ParentProfile.objects.all().delete()
    StudentProfile.objects.all().delete()
    PasswordResetToken.objects.all().delete()
    StudentProjectLike.objects.all().delete()
    StudentProject.objects.all().delete()
    Subscription.objects.all().delete()
    # Темы и курсы оставим — но почистим тоже, чтобы было в нуле
    LessonTopic.objects.all().delete()
    Course.objects.all().delete()
    User.objects.all().delete()
    print("  готово")


def ensure_roles():
    for code, name in Role.Code.choices:
        Role.objects.get_or_create(code=code, defaults={"name": name})


def make_user(username, first, last, email, role_code, *, is_super=False):
    user = User.objects.create_user(
        username=username,
        email=email,
        password=PASSWORD,
        first_name=first,
        last_name=last,
    )
    if is_super:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
    user.roles.add(Role.objects.get(code=role_code))
    return user


@transaction.atomic
def seed():
    ensure_roles()

    locations = {loc.name: loc for loc in Location.objects.all()}
    if len(locations) < 3:
        # Если по какой-то причине миграция-сидер не отработала
        for name in ("Куйбышева", "Мира", "Карла Маркса"):
            Location.objects.get_or_create(name=name)
        locations = {loc.name: loc for loc in Location.objects.all()}

    # 1. Курс и темы
    course = Course.objects.create(name="КиберШкола Junior", description="Программирование для детей")
    topics = [
        LessonTopic.objects.create(course=course, title=f"Тема {i}: модуль {i}") for i in range(1, 9)
    ]

    # 2. Админ
    admin = make_user("admin", "Админ", "Системы", "admin@КиберШкола.test", Role.Code.ADMIN, is_super=True)

    # 3. Преподаватели
    teachers = [
        make_user("anna",   "Анна",   "Иванова",  "anna@КиберШкола.test",   Role.Code.TEACHER),
        make_user("dmitry", "Дмитрий", "Петров",   "dmitry@КиберШкола.test", Role.Code.TEACHER),
        make_user("elena",  "Елена",  "Сидорова", "elena@КиберШкола.test",  Role.Code.TEACHER),
    ]

    # 4. Родители
    parents = [
        make_user("smirnov", "Сергей",  "Смирнов",  "smirnov@КиберШкола.test",  Role.Code.PARENT),
        make_user("kuznetsov", "Ольга", "Кузнецова", "kuznetsov@КиберШкола.test", Role.Code.PARENT),
        make_user("popov",    "Игорь",  "Попов",    "popov@КиберШкола.test",    Role.Code.PARENT),
    ]

    # 5. Ученики
    students_meta = [
        ("misha",   "Михаил",   "Смирнов",   parents[0]),
        ("sasha",   "Александра", "Смирнова", parents[0]),
        ("nikita",  "Никита",   "Кузнецов",  parents[1]),
        ("polina",  "Полина",   "Кузнецова", parents[1]),
        ("artem",   "Артём",    "Попов",     parents[2]),
    ]
    students = []
    for username, first, last, parent_user in students_meta:
        student = make_user(username, first, last, f"{username}@КиберШкола.test", Role.Code.STUDENT)
        sp = StudentProfile.objects.create(user=student)
        pp, _ = ParentProfile.objects.get_or_create(user=parent_user)
        pp.students.add(sp)
        students.append(student)

    # 6. Группы — на разных локациях, чтобы конфликтов не было
    # Время выбираем такое, чтобы к моменту запуска уже было несколько прошлых занятий.
    today = timezone.localtime().replace(microsecond=0, second=0)

    # Каждое занятие — длительность 120 мин.
    # Группа 1: понедельник 17:00, локация Куйбышева, преподаватель Анна
    # Группа 2: вторник 16:00, локация Мира, преподаватель Дмитрий
    # Группа 3: среда 18:00, локация Карла Маркса, преподаватель Елена
    group_specs = [
        {
            "name": "Skyforce-1",
            "location": locations["Куйбышева"],
            "teacher": teachers[0],
            "students": [students[0], students[2], students[4]],
            "weekday": 0,  # Mon
            "hour": 17,
        },
        {
            "name": "Robotron-2",
            "location": locations["Мира"],
            "teacher": teachers[1],
            "students": [students[1], students[3]],
            "weekday": 1,  # Tue
            "hour": 16,
        },
        {
            "name": "PixelPro-3",
            "location": locations["Карла Маркса"],
            "teacher": teachers[2],
            "students": [students[0], students[3], students[4]],
            "weekday": 2,  # Wed
            "hour": 18,
        },
    ]

    # Считаем понедельник 8 недель назад как стартовую точку
    start_week = (today - timedelta(weeks=8)).replace(hour=0, minute=0)
    # Сдвигаемся к ПН этой недели
    start_week = start_week - timedelta(days=start_week.weekday())

    now = timezone.now()

    for spec in group_specs:
        group = Group.objects.create(
            name=spec["name"],
            course=course,
            location=spec["location"],
            weekly_lesson_weekday=spec["weekday"],
            weekly_lesson_time=timezone.now().replace(hour=spec["hour"], minute=0, second=0, microsecond=0).time(),
        )
        GroupTeacher.objects.create(group=group, user=spec["teacher"])
        for s in spec["students"]:
            GroupStudent.objects.create(group=group, user=s)

        # Уроки: 8 недель назад → 4 недели вперёд = 12 еженедельных
        for week in range(12):
            lesson_date = (
                start_week
                + timedelta(weeks=week, days=spec["weekday"])
            ).replace(hour=spec["hour"], minute=0, second=0, microsecond=0)
            topic = topics[week % len(topics)]
            lesson = Lesson.objects.create(
                group=group,
                teacher=spec["teacher"],
                topic=topic,
                location=spec["location"],
                starts_at=lesson_date,
                is_makeup_slot=False,
            )

            # Прошлые уроки → присутствие/пропуски (около 20% пропусков)
            if lesson.starts_at < now:
                for i, s in enumerate(spec["students"]):
                    # Раскидываем пропуски, чтобы у каждого был хотя бы один
                    is_absent = ((week + i) % 5 == 0) or (week == 2 and i == 0)
                    AttendanceRecord.objects.create(
                        lesson=lesson,
                        student=s,
                        status=AttendanceRecord.Status.ABSENT
                        if is_absent
                        else AttendanceRecord.Status.PRESENT,
                        grade=None if is_absent else 5,
                    )

    # 7. Подписки на финансы создаются только после реальной оплаты,
    # поэтому здесь автоматически не создаются.

    print("\n=== Готово ===")
    print(f"Локаций: {Location.objects.count()}")
    print(f"Групп:   {Group.objects.count()}")
    print(f"Уроков:  {Lesson.objects.count()}")
    print(f"Записей посещаемости: {AttendanceRecord.objects.count()}")
    print(f"Пропусков: {AttendanceRecord.objects.filter(status='absent').count()}")
    print()
    print("Учётные записи (пароль для всех: demo12345):")
    print(f"  admin     / {PASSWORD}   — Админ Системы (суперпользователь)")
    print()
    print("  Преподаватели:")
    print(f"  anna      / {PASSWORD}   — Анна Иванова       (Skyforce-1, Куйбышева, ПН 17:00)")
    print(f"  dmitry    / {PASSWORD}   — Дмитрий Петров     (Robotron-2, Мира, ВТ 16:00)")
    print(f"  elena     / {PASSWORD}   — Елена Сидорова     (PixelPro-3, Карла Маркса, СР 18:00)")
    print()
    print("  Родители:")
    print(f"  smirnov   / {PASSWORD}   — Сергей Смирнов     (дети: Михаил, Александра)")
    print(f"  kuznetsov / {PASSWORD}   — Ольга Кузнецова    (дети: Никита, Полина)")
    print(f"  popov     / {PASSWORD}   — Игорь Попов        (дети: Артём)")
    print()
    print("  Ученики:")
    print(f"  misha     / {PASSWORD}   — Михаил Смирнов     (Skyforce-1, PixelPro-3)")
    print(f"  sasha     / {PASSWORD}   — Александра Смирнова (Robotron-2)")
    print(f"  nikita    / {PASSWORD}   — Никита Кузнецов    (Skyforce-1)")
    print(f"  polina    / {PASSWORD}   — Полина Кузнецова   (Robotron-2, PixelPro-3)")
    print(f"  artem     / {PASSWORD}   — Артём Попов        (Skyforce-1, PixelPro-3)")


if __name__ == "__main__":
    wipe()
    seed()
