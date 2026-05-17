"""Генерация красивого дерева каталогов серверной части в PNG."""
import pydot

FONT = "Consolas"
FONT_SIZE = "11"
HEADER_FONT = "Arial"

TREE = r"""
backend/
├── config/                          — настройки проекта
│   ├── settings.py                  — конфигурация Django
│   ├── urls.py                      — корневой маршрутизатор
│   └── wsgi.py                      — точка входа WSGI
│
├── apps/                            — функциональные модули
│   ├── users/                       — пользователи, роли, портфолио
│   │   ├── models.py                — User, Role, StudentProfile, ParentProfile
│   │   ├── views.py                 — API-представления
│   │   ├── churn.py                 — алгоритм расчёта риска оттока
│   │   ├── portfolio.py             — генерация PDF-портфолио
│   │   ├── auth_services.py         — логика аутентификации
│   │   └── urls.py                  — маршруты модуля
│   │
│   ├── courses/                     — курсы и группы
│   │   ├── models.py                — Course, Group, Location
│   │   ├── views.py                 — CRUD курсов, групп, локаций
│   │   └── urls.py                  — маршруты модуля
│   │
│   ├── attendance/                  — посещаемость и отработки
│   │   ├── models.py                — Lesson, AttendanceRecord, MakeUpRequest
│   │   ├── views.py                 — проведение занятий, отметки
│   │   ├── makeup_invites.py        — приглашения на отработку
│   │   └── urls.py                  — маршруты модуля
│   │
│   ├── finance/                     — финансовый модуль
│   │   ├── models.py                — Subscription, Payment, PaymentIntent
│   │   ├── views.py                 — абонементы и платежи
│   │   └── urls.py                  — маршруты модуля
│   │
│   └── notifications/               — уведомления
│       ├── telegram.py              — отправка через Telegram Bot API
│       └── signals.py               — события-триггеры
│
├── manage.py                        — CLI-утилита Django
└── requirements.txt                 — зависимости Python
""".strip()


def generate():
    g = pydot.Dot(graph_type="digraph", bgcolor="white", dpi="200", margin="0.4")
    g.set_node_defaults(shape="plaintext")

    lines = TREE.split("\n")
    # Разделим на две колонки: структура и описание
    rows = []
    for line in lines:
        if "—" in line:
            parts = line.split("—", 1)
            left = parts[0].rstrip()
            right = parts[1].strip()
            rows.append((left, right))
        elif line.strip() == "":
            rows.append(("", ""))
        else:
            rows.append((line, ""))

    # Формируем HTML-таблицу
    html_rows = []
    for left, right in rows:
        if left == "" and right == "":
            # пустая строка-разделитель
            html_rows.append(
                '<TR><TD ALIGN="LEFT"><FONT FACE="{}" POINT-SIZE="4"> </FONT></TD>'
                '<TD></TD></TR>'.format(FONT)
            )
            continue

        left_escaped = (left
                        .replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                        .replace('"', "&quot;"))

        # Подсветка папок и файлов
        is_dir = left.rstrip("/").rstrip().endswith("/")
        is_file = ".py" in left or ".txt" in left

        if is_dir:
            color = "#1B5E20"
            bold_start, bold_end = "<B>", "</B>"
        elif is_file:
            color = "#1A237E"
            bold_start, bold_end = "", ""
        else:
            color = "#333333"
            bold_start, bold_end = "", ""

        left_html = (
            f'<FONT FACE="{FONT}" POINT-SIZE="{FONT_SIZE}" COLOR="{color}">'
            f'{bold_start}{left_escaped}{bold_end}</FONT>'
        )

        right_html = ""
        if right:
            right_html = (
                f'<FONT FACE="Arial" POINT-SIZE="10" COLOR="#666666">'
                f'  {right}</FONT>'
            )

        html_rows.append(
            f'<TR>'
            f'<TD ALIGN="LEFT">{left_html}</TD>'
            f'<TD ALIGN="LEFT">{right_html}</TD>'
            f'</TR>'
        )

    table = (
        '<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">'
        + "".join(html_rows)
        + '</TABLE>'
    )

    label = f"<{table}>"
    g.add_node(pydot.Node("tree", label=label))
    g.write_png("/app/tree_backend.png")
    print("✓ /app/tree_backend.png")


if __name__ == "__main__":
    generate()
