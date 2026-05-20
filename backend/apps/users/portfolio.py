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


def _absolute_media_url(url: str) -> str:
    """Возвращает относительный URL медиа (`/media/...`).

    Браузер запросит его с того же origin, где nginx (prod) или Vite (dev)
    проксируют /media/ на backend. Работает независимо от хоста и http/https.
    """
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not url.startswith("/"):
        url = "/" + url
    return url


def _project_image_urls(project: StudentProject, request: HttpRequest = None) -> list:
    urls = []
    for image in project.images.all():
        if not image.image:
            continue
        url = _absolute_media_url(image.image.url)
        urls.append({"id": image.id, "url": url})
    return urls


def _project_file_entries(project: StudentProject, request: HttpRequest = None) -> list:
    entries = []
    for item in project.files.all():
        if not item.file:
            continue
        url = _absolute_media_url(item.file.url)
        name = item.original_name or item.file.name.rsplit("/", 1)[-1]
        entries.append({"id": item.id, "url": url, "name": name, "size": item.size})
    return entries


def build_portfolio_context(student: User, request: HttpRequest = None) -> dict:
    profile = _ensure_student_profile(student)

    projects_qs = (
        StudentProject.objects.filter(student=student)
        .prefetch_related("images", "files")
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
                "image_urls": _project_image_urls(project, request=request),
                "files": _project_file_entries(project, request=request),
            }
        )

    groups = list(
        GroupStudent.objects.filter(user=student)
        .select_related("group")
        .values_list("group__name", flat=True)
    )
    groups_data = [{"name": name} for name in groups]

    attended_qs = (
        AttendanceRecord.objects.filter(
            student=student,
            status__in=[
                AttendanceRecord.Status.PRESENT,
                AttendanceRecord.Status.MAKEUP,
            ],
        )
        .select_related("lesson", "lesson__topic", "lesson__group")
        .order_by("-lesson__starts_at")
    )

    lessons_data = []
    grades_collected = []
    for record in attended_qs:
        lesson = record.lesson
        topic_title = (lesson.conducted_topic or "").strip()
        if not topic_title and lesson.topic_id:
            topic_title = lesson.topic.title
        lessons_data.append(
            {
                "lesson_id": lesson.id,
                "starts_at": lesson.starts_at,
                "group_name": lesson.group.name if lesson.group_id else "",
                "topic": topic_title or "—",
                "status": record.status,
                "grade": record.grade,
                "teacher_comment": (record.teacher_comment or "").strip(),
                "is_makeup": bool(lesson.is_makeup_slot)
                or record.status == AttendanceRecord.Status.MAKEUP,
            }
        )
        if record.grade is not None:
            grades_collected.append(record.grade)

    grades_summary = {
        "count": len(grades_collected),
        "average": round(sum(grades_collected) / len(grades_collected), 2)
        if grades_collected
        else None,
        "max": max(grades_collected) if grades_collected else None,
        "min": min(grades_collected) if grades_collected else None,
    }

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
            "lessons_attended": len(lessons_data),
            "likes_total": likes_total,
            "grades_average": grades_summary["average"],
        },
        "groups": groups_data,
        "projects": projects,
        "lessons": lessons_data,
        "grades_summary": grades_summary,
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
