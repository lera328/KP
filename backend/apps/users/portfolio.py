"""Сборка данных портфолио и рендер PDF/HTML."""

import base64
import io
import os
from urllib.parse import urljoin

import qrcode
from django.conf import settings
from django.http import HttpRequest
from django.template.loader import render_to_string
from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.courses.models import GroupStudent

from .models import StudentProfile, StudentProject, StudentProjectLike, User


def _build_qr_data_uri(public_url: str) -> str:
    """Сгенерировать QR-код для публичной ссылки и вернуть как data: URI."""
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(public_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1f3a93", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _public_portfolio_url(request: HttpRequest, token: str) -> str:
    """Сформировать абсолютный URL публичной страницы портфолио."""
    if request is not None:
        return request.build_absolute_uri(f"/portfolio/{token}/")
    base = getattr(settings, "PUBLIC_BASE_URL", "http://localhost/")
    if not base.endswith("/"):
        base += "/"
    return urljoin(base, f"portfolio/{token}/")


def _ensure_student_profile(student: User) -> StudentProfile:
    profile, _ = StudentProfile.objects.get_or_create(user=student)
    return profile


def _project_image_paths(project: StudentProject) -> list:
    paths = []
    for image in project.images.all():
        try:
            absolute = os.path.abspath(image.image.path)
            if os.path.exists(absolute):
                paths.append(absolute)
        except (ValueError, NotImplementedError):
            continue
    return paths


def build_portfolio_context(student: User, request: HttpRequest = None) -> dict:
    profile = _ensure_student_profile(student)

    projects_qs = (
        StudentProject.objects.filter(student=student)
        .prefetch_related("images")
        .order_by("-created_at")
    )

    projects = []
    likes_total = 0
    for project in projects_qs:
        likes_count = StudentProjectLike.objects.filter(project=project).count()
        likes_total += likes_count
        projects.append(
            {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "project_url": project.project_url,
                "created_at": project.created_at,
                "likes_count": likes_count,
                "image_paths": _project_image_paths(project),
            }
        )

    groups = list(
        GroupStudent.objects.filter(user=student)
        .select_related("group", "group__course")
        .values_list("group__name", "group__course__name")
    )
    groups_data = [{"name": name, "course_title": course or "—"} for name, course in groups]

    lessons_attended = AttendanceRecord.objects.filter(
        student=student,
        status__in=[AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.MAKEUP],
    ).count()

    public_url = _public_portfolio_url(request, str(profile.portfolio_token))
    qr_data_uri = _build_qr_data_uri(public_url)

    return {
        "student_name": (student.get_full_name().strip() or student.username),
        "student_username": student.username,
        "student_email": student.email,
        "generated_at": timezone.now(),
        "qr_data_uri": qr_data_uri,
        "public_url": public_url,
        "stats": {
            "projects_total": len(projects),
            "lessons_attended": lessons_attended,
            "likes_total": likes_total,
        },
        "groups": groups_data,
        "projects": projects,
    }


def render_portfolio_html(student: User, request: HttpRequest = None) -> str:
    context = build_portfolio_context(student, request=request)
    return render_to_string("users/portfolio_pdf.html", context)


def render_portfolio_pdf(student: User, request: HttpRequest = None) -> bytes:
    """Собрать PDF портфолио ученика. Импорт WeasyPrint лениво — тяжёлый."""
    from weasyprint import HTML  # noqa: WPS433 (heavy import deferred)

    html_string = render_portfolio_html(student, request=request)
    base_url = getattr(settings, "MEDIA_ROOT", None)
    return HTML(string=html_string, base_url=str(base_url) if base_url else None).write_pdf()
