from django.core.management.base import BaseCommand
from django.db import transaction

from apps.courses.models import GroupStudent
from apps.users.models import ParentProfile, Role, StudentProfile, User


class Command(BaseCommand):
    help = (
        "Нормализует пользователей к одной роли по приоритету "
        "(admin > teacher > parent > student) и оставляет только одну группу у учеников."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать план изменений без записи в базу.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        role_priority = [
            Role.Code.ADMIN,
            Role.Code.TEACHER,
            Role.Code.PARENT,
            Role.Code.STUDENT,
        ]
        role_rank = {code: idx for idx, code in enumerate(role_priority)}

        roles_by_code = {role.code: role for role in Role.objects.filter(code__in=role_priority)}
        missing_codes = [code for code in role_priority if code not in roles_by_code]
        if missing_codes:
            self.stderr.write(self.style.ERROR(f"Отсутствуют роли в базе: {', '.join(missing_codes)}"))
            return

        users = User.objects.prefetch_related("roles").order_by("id")

        role_changes = 0
        no_role_count = 0
        superuser_fixes = 0
        student_groups_trimmed = 0
        non_student_group_links_cleared = 0
        students_without_group = 0

        with transaction.atomic():
            for user in users:
                user_role_codes = list(user.roles.values_list("code", flat=True))

                selected_code = None
                if user_role_codes:
                    selected_code = sorted(
                        user_role_codes,
                        key=lambda code: role_rank.get(code, len(role_rank)),
                    )[0]
                elif user.is_superuser:
                    selected_code = Role.Code.ADMIN
                    superuser_fixes += 1
                else:
                    no_role_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"[user:{user.id}] Нет ролей, пользователь пропущен: {user.username}"
                        )
                    )
                    continue

                needs_role_update = (len(user_role_codes) != 1) or (user_role_codes[0] != selected_code)
                if needs_role_update:
                    role_changes += 1
                    self.stdout.write(
                        f"[user:{user.id}] Роли {user_role_codes or []} -> [{selected_code}]"
                    )
                    if not dry_run:
                        user.roles.set([roles_by_code[selected_code]])

                is_student = selected_code == Role.Code.STUDENT
                group_links = GroupStudent.objects.filter(user=user).order_by("group_id", "id")
                link_count = group_links.count()

                if is_student:
                    if link_count == 0:
                        students_without_group += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"[user:{user.id}] Ученик без группы: {user.username}"
                            )
                        )
                    elif link_count > 1:
                        keep_link = group_links.first()
                        drop_links = group_links.exclude(id=keep_link.id)
                        student_groups_trimmed += drop_links.count()
                        self.stdout.write(
                            f"[user:{user.id}] Группы ученика сокращены до одной: оставлена group_id={keep_link.group_id}"
                        )
                        if not dry_run:
                            drop_links.delete()

                    if not dry_run:
                        StudentProfile.objects.get_or_create(user=user)
                else:
                    if link_count > 0:
                        non_student_group_links_cleared += link_count
                        self.stdout.write(
                            f"[user:{user.id}] Удалены привязки к группам (роль {selected_code})"
                        )
                        if not dry_run:
                            group_links.delete()

                    if selected_code == Role.Code.PARENT and not dry_run:
                        ParentProfile.objects.get_or_create(user=user)

            if dry_run:
                transaction.set_rollback(True)

        mode = "DRY-RUN" if dry_run else "APPLY"
        self.stdout.write(self.style.SUCCESS(f"Режим: {mode}"))
        self.stdout.write(self.style.SUCCESS(f"Изменено ролей: {role_changes}"))
        self.stdout.write(self.style.SUCCESS(f"Исправлено суперпользователей без роли: {superuser_fixes}"))
        self.stdout.write(self.style.SUCCESS(f"Сокращено лишних групп у учеников: {student_groups_trimmed}"))
        self.stdout.write(self.style.SUCCESS(f"Очищено связей групп у не-учеников: {non_student_group_links_cleared}"))
        self.stdout.write(self.style.WARNING(f"Учеников без группы: {students_without_group}"))
        self.stdout.write(self.style.WARNING(f"Пользователей без роли (пропущено): {no_role_count}"))
