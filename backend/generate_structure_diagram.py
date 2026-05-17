"""Генерация диаграммы структуры серверной части проекта."""
import pydot

FONT = "Arial"
GREEN = "#1B5E20"
LIGHT_GREEN = "#E8F5E9"
BLUE = "#1565C0"
LIGHT_BLUE = "#E3F2FD"
GRAY = "#546E7A"
LIGHT_GRAY = "#ECEFF1"
WHITE = "white"


def make_label(title, items, color):
    """HTML-таблица для узла."""
    header = (
        f'<TR><TD BGCOLOR="{color}" ALIGN="CENTER">'
        f'<FONT COLOR="white" FACE="{FONT}" POINT-SIZE="12"><B>{title}</B></FONT>'
        f'</TD></TR>'
    )
    rows = ""
    for item in items:
        rows += (
            f'<TR><TD ALIGN="LEFT" BGCOLOR="white">'
            f'<FONT FACE="{FONT}" POINT-SIZE="10">{item}</FONT>'
            f'</TD></TR>'
        )
    return f'<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6">{header}{rows}</TABLE>>'


def generate():
    g = pydot.Dot(graph_type="digraph", rankdir="TB", bgcolor="white", dpi="150",
                  nodesep="0.6", ranksep="0.8")
    g.set_node_defaults(shape="plaintext", fontname=FONT)
    g.set_edge_defaults(color="#90A4AE", arrowhead="vee", penwidth="1.5")

    # ── Корень ──
    g.add_node(pydot.Node("root", label=make_label(
        "backend/", ["manage.py", "requirements.txt"], GRAY
    )))

    # ── config/ ──
    g.add_node(pydot.Node("config", label=make_label(
        "config/ — Настройки проекта",
        ["settings.py — конфигурация Django",
         "urls.py — корневой маршрутизатор",
         "wsgi.py — точка входа WSGI"],
        GRAY
    )))

    # ── apps/ ──
    g.add_node(pydot.Node("apps", label=make_label(
        "apps/ — Функциональные модули", [], GREEN
    )))

    # ── Модули ──
    modules = [
        ("users", "users/", [
            "models.py — User, Role, профили",
            "views.py — API-представления",
            "churn.py — алгоритм антиоттока",
            "portfolio.py — генерация портфолио",
            "auth_services.py — аутентификация",
            "urls.py — маршруты модуля",
        ]),
        ("courses", "courses/", [
            "models.py — Course, Group, Location",
            "views.py — CRUD курсов и групп",
            "urls.py — маршруты модуля",
        ]),
        ("attendance", "attendance/", [
            "models.py — Lesson, Attendance, MakeUp",
            "views.py — посещаемость, отработки",
            "makeup_invites.py — приглашения",
            "urls.py — маршруты модуля",
        ]),
        ("finance", "finance/", [
            "models.py — Subscription, Payment",
            "views.py — абонементы, платежи",
            "urls.py — маршруты модуля",
        ]),
        ("notifications", "notifications/", [
            "telegram.py — Telegram Bot API",
            "signals.py — события-триггеры",
        ]),
    ]

    colors = [GREEN, BLUE, GREEN, BLUE, GRAY]

    for (mid, title, items), color in zip(modules, colors):
        g.add_node(pydot.Node(mid, label=make_label(title, items, color)))
        g.add_edge(pydot.Edge("apps", mid))

    # ── Рёбра от корня ──
    g.add_edge(pydot.Edge("root", "config"))
    g.add_edge(pydot.Edge("root", "apps"))

    # ── Ранги ──
    same_rank = pydot.Subgraph(rank="same")
    for mid, _, _ in modules:
        same_rank.add_node(pydot.Node(mid))
    g.add_subgraph(same_rank)

    g.write_png("/app/structure_backend.png")
    print("✓ /app/structure_backend.png")


if __name__ == "__main__":
    generate()
