# Деплой КиберШкола на VPS

## 1. Аренда VPS

Подойдёт **любой** Linux VPS с минимум **1 ГБ RAM** и **10 ГБ диска**.

Рекомендуемые провайдеры:
- **Timeweb Cloud** — от 179₽/мес, серверы в РФ, простая панель
- **Selectel** — от 300₽/мес, надёжный
- **reg.ru** — от 199₽/мес
- **DigitalOcean** — $6/мес (нужна карта)

При создании выбирай:
- ОС: **Ubuntu 22.04** (или 24.04)
- RAM: 1 ГБ (лучше 2 ГБ)
- Диск: 10+ ГБ SSD

После создания тебе дадут **IP-адрес** и **пароль root**.

---

## 2. Подключение к серверу

Открой терминал (PowerShell на Windows) и подключись:

```bash
ssh root@ТВОЙ_IP_АДРЕС
```

Введи пароль, который пришёл от провайдера.

---

## 3. Установка Docker на сервере

Скопируй и вставь эти команды **на сервере** (после подключения по SSH):

```bash
# Обновляем систему
apt update && apt upgrade -y

# Ставим Docker
curl -fsSL https://get.docker.com | sh

# Ставим Docker Compose (уже встроен в новый Docker)
docker compose version

# Ставим Git
apt install -y git
```

---

## 4. Клонирование проекта

```bash
cd /opt
git clone https://github.com/lera328/KP.git kiberone
cd kiberone
```

---

## 5. Настройка окружения

Создай файл `.env`:

```bash
nano .env
```

Вставь содержимое (замени значения на свои):

```env
POSTGRES_DB=kiberone
POSTGRES_USER=kiberone_user
POSTGRES_PASSWORD=СГЕНЕРИРУЙ_СЛОЖНЫЙ_ПАРОЛЬ
POSTGRES_HOST=db
POSTGRES_PORT=5432
DJANGO_SECRET_KEY=СГЕНЕРИРУЙ_ДЛИННЫЙ_КЛЮЧ
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=ТВОЙ_IP_АДРЕС,localhost,127.0.0.1,backend
PUBLIC_FRONTEND_URL=http://ТВОЙ_IP_АДРЕС
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=1
DEFAULT_FROM_EMAIL=KiberOne <noreply@kiberone.local>
TELEGRAM_BOT_TOKEN=
PAYMENT_REMINDER_LESSON_THRESHOLD=3
TEACHER_RATE_PER_LESSON=1500
TEACHER_RATE_PER_MAKEUP=1000
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

**Сгенерировать пароли** можно так:
```bash
# Пароль для Postgres
openssl rand -hex 16

# Секретный ключ Django
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## 6. Запуск

```bash
cd /opt/kiberone
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Первый запуск займёт 3–5 минут (скачивание образов, сборка).

Проверь, что всё работает:
```bash
docker compose ps
```

Все три контейнера (`db`, `backend`, `frontend`) должны быть в статусе `Up` / `healthy`.

---

## 7. Создание суперпользователя

```bash
docker compose exec backend python manage.py createsuperuser
```

Введи email, имя пользователя и пароль для администратора.

---

## 8. Проверка

Открой в браузере:
- **http://ТВОЙ_IP_АДРЕС** — фронтенд (логин)
- **http://ТВОЙ_IP_АДРЕС/admin/** — Django-админка
- **http://ТВОЙ_IP_АДРЕС/api/health/** — проверка бэкенда

---

## 9. Обновление (когда пушишь изменения)

На сервере:
```bash
cd /opt/kiberone
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 10. Полезные команды

```bash
# Логи бэкенда
docker compose logs -f backend

# Логи фронтенда (nginx)
docker compose logs -f frontend

# Перезапуск
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Остановка
docker compose down

# Загрузить демо-данные (если есть seed_demo.py)
docker compose exec backend python seed_demo.py

# Бэкап базы данных
docker compose exec db pg_dump -U kiberone_user kiberone > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
cat backup.sql | docker compose exec -T db psql -U kiberone_user kiberone
```

---

## 11. Домен (опционально)

Если хочешь красивый адрес вместо IP:

1. Купи домен (например, на reg.ru, ~200₽/год за .ru)
2. В DNS домена добавь **A-запись**: `@ → ТВОЙ_IP_АДРЕС`
3. Обнови `.env`: `DJANGO_ALLOWED_HOSTS=твойдомен.ru,...` и `PUBLIC_FRONTEND_URL=http://твойдомен.ru`
4. Перезапусти: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

### HTTPS (бесплатный SSL через Let's Encrypt):

```bash
apt install -y certbot
certbot certonly --standalone -d твойдомен.ru
```

Затем обнови `nginx.conf` для HTTPS (могу помочь с этим отдельно).
