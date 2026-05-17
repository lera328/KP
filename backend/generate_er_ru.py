"""Генерация ER-диаграмм с русскими подписями."""
import pydot

FONT = "Arial"
TABLE_COLOR = "#1B5E20"
HEADER_FONT_COLOR = "white"
FIELD_FONT_COLOR = "#222222"

# ── Словари моделей по модулям ──────────────────────────────────────

USERS_MODULE = {
    "title": "Модуль «Пользователи и роли»",
    "tables": {
        "Пользователь (User)": [
            ("id", "BigAutoField", "PK"),
            ("username", "CharField", "Логин"),
            ("email", "EmailField", "Эл. почта"),
            ("first_name", "CharField", "Имя"),
            ("last_name", "CharField", "Фамилия"),
            ("password", "CharField", "Хеш пароля"),
            ("phone", "CharField", "Телефон"),
            ("telegram_chat_id", "CharField", "Telegram ID"),
            ("must_change_password", "BooleanField", "Сменить пароль"),
            ("is_active", "BooleanField", "Активен"),
        ],
        "Роль (Role)": [
            ("id", "BigAutoField", "PK"),
            ("code", "CharField", "Код (admin/teacher/parent/student)"),
            ("name", "CharField", "Название"),
        ],
        "Профиль ученика\n(StudentProfile)": [
            ("id", "BigAutoField", "PK"),
            ("user", "OneToOneField → User", "FK"),
            ("portfolio_token", "UUIDField", "Токен портфолио"),
        ],
        "Профиль родителя\n(ParentProfile)": [
            ("id", "BigAutoField", "PK"),
            ("user", "OneToOneField → User", "FK"),
            ("students", "M2M → StudentProfile", "Дети"),
        ],
        "Токен сброса пароля\n(PasswordResetToken)": [
            ("id", "BigAutoField", "PK"),
            ("user", "ForeignKey → User", "FK"),
            ("token", "UUIDField", "Токен"),
            ("created_at", "DateTimeField", "Дата создания"),
            ("used_at", "DateTimeField", "Дата использования"),
        ],
    },
    "edges": [
        ("Пользователь (User)", "Роль (Role)", "roles\n(M2M)"),
        ("Профиль ученика\n(StudentProfile)", "Пользователь (User)", "user\n(1:1)"),
        ("Профиль родителя\n(ParentProfile)", "Пользователь (User)", "user\n(1:1)"),
        ("Профиль родителя\n(ParentProfile)", "Профиль ученика\n(StudentProfile)", "students\n(M2M)"),
        ("Токен сброса пароля\n(PasswordResetToken)", "Пользователь (User)", "user\n(FK)"),
    ],
}

EDUCATION_MODULE = {
    "title": "Модуль «Учебный процесс»",
    "tables": {
        "Курс (Course)": [
            ("id", "BigAutoField", "PK"),
            ("name", "CharField", "Название"),
            ("description", "TextField", "Описание"),
            ("is_active", "BooleanField", "Активен"),
        ],
        "Группа (Group)": [
            ("id", "BigAutoField", "PK"),
            ("course", "FK → Course", "Курс"),
            ("location", "FK → Location", "Локация"),
            ("name", "CharField", "Название"),
            ("weekly_lesson_weekday", "SmallInt", "День недели"),
            ("weekly_lesson_time", "TimeField", "Время занятия"),
            ("is_active", "BooleanField", "Активна"),
        ],
        "Локация (Location)": [
            ("id", "BigAutoField", "PK"),
            ("name", "CharField", "Название"),
            ("address", "CharField", "Адрес"),
            ("is_active", "BooleanField", "Активна"),
        ],
        "Ученик в группе\n(GroupStudent)": [
            ("id", "BigAutoField", "PK"),
            ("group", "FK → Group", "Группа"),
            ("user", "FK → User", "Ученик"),
        ],
        "Преподаватель группы\n(GroupTeacher)": [
            ("id", "BigAutoField", "PK"),
            ("group", "FK → Group", "Группа"),
            ("user", "FK → User", "Преподаватель"),
        ],
        "Тема занятия\n(LessonTopic)": [
            ("id", "BigAutoField", "PK"),
            ("course", "FK → Course", "Курс"),
            ("title", "CharField", "Название темы"),
        ],
        "Занятие (Lesson)": [
            ("id", "BigAutoField", "PK"),
            ("group", "FK → Group", "Группа"),
            ("teacher", "FK → User", "Преподаватель"),
            ("topic", "FK → LessonTopic", "Тема"),
            ("location", "FK → Location", "Локация"),
            ("starts_at", "DateTimeField", "Дата и время"),
            ("conducted_topic", "CharField", "Проведённая тема"),
            ("conducted_description", "TextField", "Описание"),
            ("homework", "TextField", "Домашнее задание"),
            ("is_makeup_slot", "BooleanField", "Слот отработки"),
            ("makeup_capacity", "SmallInt", "Вместимость"),
        ],
        "Запись посещаемости\n(AttendanceRecord)": [
            ("id", "BigAutoField", "PK"),
            ("lesson", "FK → Lesson", "Занятие"),
            ("student", "FK → User", "Ученик"),
            ("status", "CharField", "Статус (присут./пропуск/отраб.)"),
            ("grade", "SmallInt", "Оценка"),
            ("teacher_comment", "TextField", "Комментарий"),
            ("charged", "BooleanField", "Списано с абонемента"),
        ],
        "Заявка на отработку\n(MakeUpRequest)": [
            ("id", "BigAutoField", "PK"),
            ("absence_record", "FK → AttendanceRecord", "Запись пропуска"),
            ("makeup_lesson", "FK → Lesson", "Занятие-отработка"),
            ("student", "FK → User", "Ученик"),
            ("status", "CharField", "Статус (запрош./провед./подтв.)"),
            ("approved_by", "FK → User", "Подтвердил"),
            ("approved_at", "DateTimeField", "Дата подтверждения"),
        ],
    },
    "edges": [
        ("Группа (Group)", "Курс (Course)", "course (FK)"),
        ("Группа (Group)", "Локация (Location)", "location (FK)"),
        ("Ученик в группе\n(GroupStudent)", "Группа (Group)", "group (FK)"),
        ("Преподаватель группы\n(GroupTeacher)", "Группа (Group)", "group (FK)"),
        ("Тема занятия\n(LessonTopic)", "Курс (Course)", "course (FK)"),
        ("Занятие (Lesson)", "Группа (Group)", "group (FK)"),
        ("Занятие (Lesson)", "Тема занятия\n(LessonTopic)", "topic (FK)"),
        ("Занятие (Lesson)", "Локация (Location)", "location (FK)"),
        ("Запись посещаемости\n(AttendanceRecord)", "Занятие (Lesson)", "lesson (FK)"),
        ("Заявка на отработку\n(MakeUpRequest)", "Запись посещаемости\n(AttendanceRecord)", "absence_record\n(FK)"),
        ("Заявка на отработку\n(MakeUpRequest)", "Занятие (Lesson)", "makeup_lesson\n(FK)"),
    ],
}

FINANCE_MODULE = {
    "title": "Модуль «Финансы»",
    "tables": {
        "Абонемент\n(Subscription)": [
            ("id", "BigAutoField", "PK"),
            ("student", "FK → User", "Ученик"),
            ("total_lessons", "PositiveInt", "Всего занятий"),
            ("remaining_lessons", "PositiveInt", "Осталось занятий"),
            ("valid_from", "DateField", "Действует с"),
            ("valid_until", "DateField", "Действует до"),
            ("is_active", "BooleanField", "Активен"),
            ("created_at", "DateTimeField", "Дата создания"),
        ],
        "Платёж (Payment)": [
            ("id", "BigAutoField", "PK"),
            ("subscription", "FK → Subscription", "Абонемент"),
            ("amount", "DecimalField", "Сумма"),
            ("paid_at", "DateTimeField", "Дата оплаты"),
        ],
        "Намерение оплаты\n(PaymentIntent)": [
            ("id", "BigAutoField", "PK"),
            ("student", "FK → User", "Ученик"),
            ("parent", "FK → User", "Родитель"),
            ("plan", "CharField", "Тариф (месяц/полгода/год)"),
            ("amount", "DecimalField", "Сумма"),
            ("lessons", "PositiveInt", "Кол-во занятий"),
            ("status", "CharField", "Статус (ожид./оплач./ошибка)"),
            ("created_at", "DateTimeField", "Дата создания"),
        ],
    },
    "edges": [
        ("Платёж (Payment)", "Абонемент\n(Subscription)", "subscription (FK)"),
    ],
}

PORTFOLIO_MODULE = {
    "title": "Модуль «Портфолио и проекты»",
    "tables": {
        "Проект ученика\n(StudentProject)": [
            ("id", "BigAutoField", "PK"),
            ("student", "FK → User", "Ученик"),
            ("title", "CharField", "Название"),
            ("description", "TextField", "Описание"),
            ("project_url", "URLField", "Ссылка на проект"),
            ("created_at", "DateTimeField", "Дата создания"),
        ],
        "Изображение проекта\n(StudentProjectImage)": [
            ("id", "BigAutoField", "PK"),
            ("project", "FK → StudentProject", "Проект"),
            ("image", "ImageField", "Файл изображения"),
            ("created_at", "DateTimeField", "Дата загрузки"),
        ],
        "Файл проекта\n(StudentProjectFile)": [
            ("id", "BigAutoField", "PK"),
            ("project", "FK → StudentProject", "Проект"),
            ("file", "FileField", "Файл"),
            ("original_name", "CharField", "Исходное имя файла"),
            ("size", "BigIntField", "Размер (байт)"),
        ],
        "Лайк (StudentProjectLike)": [
            ("id", "BigAutoField", "PK"),
            ("project", "FK → StudentProject", "Проект"),
            ("user", "FK → User", "Пользователь"),
            ("created_at", "DateTimeField", "Дата"),
        ],
    },
    "edges": [
        ("Изображение проекта\n(StudentProjectImage)", "Проект ученика\n(StudentProject)", "project (FK)"),
        ("Файл проекта\n(StudentProjectFile)", "Проект ученика\n(StudentProject)", "project (FK)"),
        ("Лайк (StudentProjectLike)", "Проект ученика\n(StudentProject)", "project (FK)"),
    ],
}


def _make_table_html(name, fields):
    """Сформировать HTML-таблицу для узла Graphviz."""
    header = (
        f'<TR><TD COLSPAN="3" BGCOLOR="{TABLE_COLOR}">'
        f'<FONT COLOR="{HEADER_FONT_COLOR}" FACE="{FONT}"><B>{name}</B></FONT>'
        f'</TD></TR>'
    )
    rows = []
    for fname, ftype, comment in fields:
        rows.append(
            f'<TR>'
            f'<TD ALIGN="LEFT"><FONT FACE="{FONT}" POINT-SIZE="10">{fname}</FONT></TD>'
            f'<TD ALIGN="LEFT"><FONT FACE="{FONT}" POINT-SIZE="9" COLOR="#555555"><I>{ftype}</I></FONT></TD>'
            f'<TD ALIGN="LEFT"><FONT FACE="{FONT}" POINT-SIZE="9" COLOR="#888888">{comment}</FONT></TD>'
            f'</TR>'
        )
    body = "".join(rows)
    return f'<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">{header}{body}</TABLE>>'


def generate_module_diagram(module, filename):
    graph = pydot.Dot(graph_type="digraph", rankdir="TB", bgcolor="white", dpi="150")
    graph.set_node_defaults(shape="plaintext", fontname=FONT)
    graph.set_edge_defaults(fontname=FONT, fontsize="9", color="#555555", fontcolor="#333333")

    for tname, fields in module["tables"].items():
        label = _make_table_html(tname, fields)
        graph.add_node(pydot.Node(tname, label=label))

    for src, dst, lbl in module["edges"]:
        graph.add_edge(pydot.Edge(src, dst, label=f"  {lbl}  ", arrowhead="normal"))

    graph.write_png(filename)
    print(f"  ✓ {filename}")


if __name__ == "__main__":
    print("Генерация ER-диаграмм (RU)...")
    generate_module_diagram(USERS_MODULE, "/app/er_ru_1_users.png")
    generate_module_diagram(EDUCATION_MODULE, "/app/er_ru_2_education.png")
    generate_module_diagram(FINANCE_MODULE, "/app/er_ru_3_finance.png")
    generate_module_diagram(PORTFOLIO_MODULE, "/app/er_ru_4_portfolio.png")
    print("Готово!")
