# 🎓 КиберШкола — Система управления школой программирования

> Веб-платформа для управления образовательным центром: ученики, преподаватели, расписание, оплата и уведомления.

![Django](https://img.shields.io/badge/Backend-Django-092E20?logo=django)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker)
![JavaScript](https://img.shields.io/badge/Frontend-JavaScript-F7DF1E?logo=javascript)
![Status](https://img.shields.io/badge/status-in_development-orange)

---

## 📋 О проекте

**КиберШкола** — полноценная веб-платформа для управления детской школой программирования.  
Система автоматизирует работу администраторов и преподавателей: учёт учеников, расписание занятий, контроль оплаты, рассылка уведомлений.

Проект развёрнут на VPS с использованием Docker и Nginx.

---

## ⚡ Функциональность

- 👩‍🎓 **Управление учениками** — профили, статусы, история занятий
- 👨‍🏫 **Преподаватели** — расписание, ставки, учёт часов
- 📅 **Расписание** — занятия, отработки, отмены
- 💳 **Оплата** — контроль платежей, напоминания
- 📧 **Email-уведомления** — автоматические рассылки
- 🤖 **Telegram-бот** — уведомления преподавателям

---

## 🛠 Технологии

| Слой | Технологии |
|---|---|
| **Backend** | Python, Django, Django REST Framework |
| **База данных** | PostgreSQL |
| **Frontend** | JavaScript, HTML/CSS |
| **Деплой** | Docker, Docker Compose, Nginx |
| **Уведомления** | SMTP Email, Telegram Bot API |
| **Конфигурация** | .env, переменные окружения |

---

## 📁 Структура проекта

```
KP/
├── backend/              # Django-приложение
├── frontend/             # Клиентская часть
├── docs/                 # Документация
├── docker-compose.yml         # Dev-окружение
├── docker-compose.prod.yml    # Продакшн-окружение
├── .env.example          # Пример переменных окружения
└── DEPLOY.md             # Инструкция по деплою
```

---

## 🚀 Быстрый старт (локально)

### Требования
- Docker + Docker Compose
- Git

### Запуск

```bash
# Клонировать
git clone https://github.com/lera328/KP.git
cd KP

# Создать файл окружения
cp .env.example .env
# Отредактировать .env — задать пароли и ключи

# Запустить
docker compose up --build
```

Приложение будет доступно на: `http://localhost`

---

## ⚙️ Переменные окружения

Скопируй `.env.example` в `.env` и заполни:

```env
POSTGRES_DB=kiberone
POSTGRES_USER=kiberone_user
POSTGRES_PASSWORD=ваш_пароль
DJANGO_SECRET_KEY=ваш_секретный_ключ
DJANGO_DEBUG=1
TELEGRAM_BOT_TOKEN=токен_бота
```

---

## 🌐 Деплой на VPS

Подробная инструкция по деплою: [DEPLOY.md](./DEPLOY.md)

**Кратко:**
1. Арендовать VPS с Ubuntu 22.04
2. Установить Docker
3. Клонировать репозиторий
4. Настроить `.env`
5. Запустить `docker compose -f docker-compose.prod.yml up -d`

---

## 👩‍💻 Автор

**Валерия Шульгина** — [github.com/lera328](https://github.com/lera328)  
Курсовой проект, ОмГТУ, Программная инженерия, 2026
