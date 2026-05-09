"""FR-12 — отчёты и аналитика для админ-дашборда.

Метрики за период:
- активные ученики, ученики с риском оттока;
- проведённые уроки, % посещаемости, средняя оценка;
- выручка и количество платежей;
- разбивка по группам.
"""

from datetime import datetime, time
from decimal import Decimal

from django.db.models import Avg, Sum
from django.utils import timezone

from apps.attendance.models import AttendanceRecord, Lesson
from apps.courses.models import Group
from apps.finance.models import Payment

from .churn import compute_churn_report
from .models import Role, User


def _parse_date(value, default):
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return default


def _date_range(date_from_str, date_to_str):
    today = timezone.localdate()
    first_of_month = today.replace(day=1)
    date_from = _parse_date(date_from_str, first_of_month)
    date_to = _parse_date(date_to_str, today)
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(date_from, time.min), tz)
    end_dt = timezone.make_aware(datetime.combine(date_to, time.max), tz)
    return date_from, date_to, start_dt, end_dt


def _group_breakdown(start_dt, end_dt, group_id=None):
    groups_qs = Group.objects.all().order_by("name")
    if group_id:
        groups_qs = groups_qs.filter(id=group_id)

    rows = []
    for group in groups_qs:
        lessons_qs = Lesson.objects.filter(
            group=group, starts_at__gte=start_dt, starts_at__lte=end_dt
        )
        records_qs = AttendanceRecord.objects.filter(
            lesson__group=group,
            lesson__starts_at__gte=start_dt,
            lesson__starts_at__lte=end_dt,
        )

        total_records = records_qs.count()
        present_records = records_qs.filter(
            status__in=[
                AttendanceRecord.Status.PRESENT,
                AttendanceRecord.Status.MAKEUP,
            ]
        ).count()
        avg_grade = records_qs.aggregate(avg=Avg("grade"))["avg"]
        students_count = (
            records_qs.values("student_id").distinct().count()
        )

        attendance_rate = None
        if total_records:
            attendance_rate = round(present_records / total_records, 2)

        rows.append(
            {
                "group_id": group.id,
                "group_name": group.name,
                "lessons_count": lessons_qs.count(),
                "students_count": students_count,
                "attendance_rate": attendance_rate,
                "average_grade": round(float(avg_grade), 2) if avg_grade is not None else None,
            }
        )
    return rows


def compute_dashboard_metrics(date_from_str=None, date_to_str=None, group_id=None) -> dict:
    date_from, date_to, start_dt, end_dt = _date_range(date_from_str, date_to_str)

    students_qs = User.objects.filter(
        is_active=True, roles__code=Role.Code.STUDENT
    ).distinct()
    students_total = students_qs.count()

    churn_rows = compute_churn_report()
    students_at_risk = sum(1 for r in churn_rows if r["risk_level"] in ("high", "medium"))
    students_high_risk = sum(1 for r in churn_rows if r["risk_level"] == "high")

    records_qs = AttendanceRecord.objects.filter(
        lesson__starts_at__gte=start_dt, lesson__starts_at__lte=end_dt
    )
    if group_id:
        records_qs = records_qs.filter(lesson__group_id=group_id)

    total_records = records_qs.count()
    present_records = records_qs.filter(
        status__in=[
            AttendanceRecord.Status.PRESENT,
            AttendanceRecord.Status.MAKEUP,
        ]
    ).count()
    absent_records = records_qs.filter(status=AttendanceRecord.Status.ABSENT).count()
    attendance_rate = round(present_records / total_records, 2) if total_records else None
    avg_grade = records_qs.aggregate(avg=Avg("grade"))["avg"]

    lessons_qs = Lesson.objects.filter(starts_at__gte=start_dt, starts_at__lte=end_dt)
    if group_id:
        lessons_qs = lessons_qs.filter(group_id=group_id)
    lessons_count = lessons_qs.count()

    payments_qs = Payment.objects.filter(paid_at__gte=start_dt, paid_at__lte=end_dt)
    if group_id:
        payments_qs = payments_qs.filter(subscription__student__groupstudent__group_id=group_id)
    payments_count = payments_qs.count()
    revenue_total = payments_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

    groups = _group_breakdown(start_dt, end_dt, group_id=group_id)
    groups_options = [
        {"id": g.id, "name": g.name}
        for g in Group.objects.all().order_by("name")
    ]

    return {
        "period": {
            "from": date_from.isoformat(),
            "to": date_to.isoformat(),
        },
        "kpi": {
            "students_total": students_total,
            "students_at_risk": students_at_risk,
            "students_high_risk": students_high_risk,
            "lessons_count": lessons_count,
            "attendance_records_total": total_records,
            "attendance_rate": attendance_rate,
            "absences": absent_records,
            "average_grade": round(float(avg_grade), 2) if avg_grade is not None else None,
            "payments_count": payments_count,
            "revenue_total": str(revenue_total),
        },
        "groups": groups,
        "groups_options": groups_options,
    }


def render_dashboard_csv(date_from_str=None, date_to_str=None, group_id=None) -> str:
    """CSV-выгрузка для управленческого анализа: KPI + разбивка по группам."""
    import csv
    import io

    metrics = compute_dashboard_metrics(date_from_str, date_to_str, group_id)
    period = metrics["period"]
    kpi = metrics["kpi"]
    groups = metrics["groups"]

    buf = io.StringIO()
    buf.write("\ufeff")  # BOM для Excel
    writer = csv.writer(buf, delimiter=";")

    writer.writerow(["KiberOne — отчёт за период", f'{period["from"]} — {period["to"]}'])
    writer.writerow([])
    writer.writerow(["Сводные показатели"])
    writer.writerow(["Учеников активных", kpi["students_total"]])
    writer.writerow(["С риском оттока (high+medium)", kpi["students_at_risk"]])
    writer.writerow(["Высокий риск", kpi["students_high_risk"]])
    writer.writerow(["Уроков проведено", kpi["lessons_count"]])
    writer.writerow([
        "Посещаемость",
        f'{int(kpi["attendance_rate"] * 100)}%' if kpi["attendance_rate"] is not None else "—",
    ])
    writer.writerow(["Пропусков", kpi["absences"]])
    writer.writerow([
        "Средняя оценка",
        kpi["average_grade"] if kpi["average_grade"] is not None else "—",
    ])
    writer.writerow(["Платежей", kpi["payments_count"]])
    writer.writerow(["Выручка, ₽", kpi["revenue_total"]])

    writer.writerow([])
    writer.writerow(["Разбивка по группам"])
    writer.writerow(["Группа", "Уроков", "Учеников", "Посещаемость", "Средняя оценка"])
    for row in groups:
        writer.writerow([
            row["group_name"],
            row["lessons_count"],
            row["students_count"],
            f'{int(row["attendance_rate"] * 100)}%' if row["attendance_rate"] is not None else "—",
            row["average_grade"] if row["average_grade"] is not None else "—",
        ])

    return buf.getvalue()
