import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    class Code(models.TextChoices):
        ADMIN = "admin", "Администратор"
        TEACHER = "teacher", "Преподаватель"
        PARENT = "parent", "Родитель"
        STUDENT = "student", "Ученик"

    code = models.CharField(max_length=32, choices=Code.choices, unique=True)
    name = models.CharField(max_length=64)

    def __str__(self):
        return self.name


class User(AbstractUser):
    phone = models.CharField(max_length=20, blank=True)
    telegram_chat_id = models.CharField(max_length=64, blank=True)
    roles = models.ManyToManyField(Role, related_name="users", blank=True)
    must_change_password = models.BooleanField(
        default=False,
        help_text="Пользователь обязан сменить пароль при следующем входе.",
    )


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    TTL_HOURS = 2

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_valid(self):
        from datetime import timedelta

        from django.utils import timezone

        if self.used_at:
            return False
        return self.created_at >= timezone.now() - timedelta(hours=self.TTL_HOURS)


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    portfolio_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    def __str__(self):
        return f"Student: {self.user.get_full_name() or self.user.username}"


class ParentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="parent_profile")
    students = models.ManyToManyField(StudentProfile, blank=True, related_name="parents")

    def __str__(self):
        return f"Parent: {self.user.get_full_name() or self.user.username}"


class StudentProject(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Project #{self.id} ({self.student_id})"


class StudentProjectImage(models.Model):
    project = models.ForeignKey(StudentProject, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="projects/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ProjectImage #{self.id} ({self.project_id})"


class StudentProjectLike(models.Model):
    project = models.ForeignKey(StudentProject, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="project_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "user"], name="unique_project_like"),
        ]

    def __str__(self):
        return f"ProjectLike #{self.id} ({self.project_id})"
