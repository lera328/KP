# План разработки автоматизированной системы управления KiberOne

## 1. Общая информация

**Назначение проекта:** Разработка автоматизированной системы управления образовательными процессами для школы программирования KiberOne.

**Целевая аудитория:**
- Администраторы школы (менеджеры)
- Преподаватели
- Родители учащихся
- Ученики

**Ожидаемый результат:** Полнофункциональная веб-платформа с REST API, интеграцией с Telegram, системой аналитики и PDF-отчетами.

---

## 2. Этапы разработки

### 2.1 Этап 1: Подготовка и планирование (Неделя 1-2)

**Задачи:**
- ✓ Формализация требований
- ✓ Разработка архитектурной модели (выполнено)
- ✓ Создание диаграмм системы (выполнено)
- ✓ Настройка окружения разработки
- ✓ Создание git-репозитория

**Мероприятия:**
- Встреча с заказчиком (школой KiberOne)
- Согласование функциональной спецификации
- Разработка плана спринтов
- Подготовка документации

**Результат:** Детальное техническое задание и план работ.

---

### 2.2 Этап 2: Подготовка инфраструктуры (Неделя 3)

**Задачи:**
- Настройка PostgreSQL локально
- Создание Docker Compose конфигурации
- Настройка Git и GitHub
- Подготовка виртуального окружения Python и Node.js

**Инструменты:**
- PostgreSQL 14+
- Docker Desktop
- Docker Compose
- VS Code с расширениями
- DBeaver для управления БД
- pgAdmin для веб-интерфейса БД

**Результат:** Готовое локальное окружение с docker-compose.yml для срочного запуска.

---

### 2.3 Этап 3: Разработка Backend (Неделя 4-8)

#### 3.1 Инициализация проекта Django

**Задачи:**
- Создание Django-проекта с наследованием User
- Установка django-rest-framework
- Настройка CORS и безопасности
- Создание структуры приложений

**Структура приложений:**
```
backend/
├── users/          # Пользователи, аутентификация, роли
├── courses/        # Курсы, группы, расписание
├── attendance/     # Посещаемость, отработки, пропуски
├── finance/        # Абонементы, платежи, счета
├── portfolio/      # Портфолио, проекты, работы ученика
├── analytics/      # Аналитика рисков, статистика
├── notifications/  # Уведомления, интеграция Telegram
├── api/            # Общие вспомогательные функции API
└── config/         # Настройки проекта

```

#### 3.2 Реализация моделей данных

**Модель "Пользователи и роли":**
- User (базовый пользователь)
- Administrator (администратор)
- Teacher (преподаватель)
- Parent (родитель)
- Student (ученик)
- Role (роль пользователя)
- Permission (разрешения)

**Модель "Учебный процесс":**
- Course (курс)
- Group (группа учащихся)
- Schedule (расписание)
- Lesson (занятие)
- Attendance (посещаемость)
- MakeUp (отработка пропуска)
- StudentCourse (связь ученик-курс)

**Модель "Финансы и уведомления":**
- Subscription (абонемент)
- Invoice (счет)
- Payment (платеж)
- Notification (уведомление)
- TelegramUser (привязка к Telegram)

**Модель "Портфолио и проекты":**
- Portfolio (портфолио ученика)
- Project (проект)
- ProjectWork (работа/задача проекта)
- Vote (голосование за лучшую работу)
- ProjectFeed (лента проектов)

#### 3.3 Реализация API endpoints

**Аутентификация и управление пользователями:**
```
POST   /api/auth/register/           - Регистрация
POST   /api/auth/login/              - Вход
POST   /api/auth/logout/             - Выход
GET    /api/auth/profile/            - Профиль текущего пользователя
PATCH  /api/auth/profile/update/     - Обновление профиля
POST   /api/auth/refresh-token/      - Обновление токена
```

**Управление пользователями (для администратора):**
```
GET    /api/users/                   - Список пользователей
POST   /api/users/                   - Создание пользователя
GET    /api/users/<id>/              - Профиль пользователя
PATCH  /api/users/<id>/              - Редактирование пользователя
DELETE /api/users/<id>/              - Удаление пользователя
GET    /api/users/<id>/permissions/  - Разрешения пользователя
```

**Управление курсами и группами:**
```
GET    /api/courses/                 - Список курсов
POST   /api/courses/                 - Создание курса
GET    /api/courses/<id>/            - Детали курса
PATCH  /api/courses/<id>/            - Редактирование курса
GET    /api/groups/                  - Список групп
POST   /api/groups/                  - Создание группы
GET    /api/groups/<id>/students/    - Студенты в группе
POST   /api/groups/<id>/students/    - Добавление студента в группу
```

**Расписание и уроки:**
```
GET    /api/schedule/                - Расписание
POST   /api/schedule/create/         - Создание расписания
GET    /api/lessons/                 - Уроки
POST   /api/lessons/                 - Создание урока
PATCH  /api/lessons/<id>/            - Редактирование урока
GET    /api/lessons/<id>/attendance/ - Посещаемость на уроке
```

**Посещаемость и отработки:**
```
POST   /api/attendance/mark/         - Отметить посещаемость
GET    /api/attendance/student/<id>/ - История посещаемости студента
GET    /api/attendance/stats/        - Статистика посещаемости
POST   /api/makeups/request/         - Запросить отработку
GET    /api/makeups/                 - Список отработок
PATCH  /api/makeups/<id>/approve/    - Одобрить отработку
```

**Финансы:**
```
GET    /api/subscriptions/           - Типы абонементов
POST   /api/invoices/create/         - Создание счета
GET    /api/invoices/                - Счета
POST   /api/payments/create/         - Создание платежа
GET    /api/payments/                - История платежей
GET    /api/payments/student/<id>/   - Платежи студента
```

**Портфолио и проекты:**
```
GET    /api/portfolios/              - Портфолио учеников
GET    /api/portfolios/<id>/         - Портфолио студента
POST   /api/projects/                - Создание проекта
GET    /api/projects/                - Список проектов
GET    /api/projects/feed/           - Лента проектов текущей недели
POST   /api/projects/<id>/submit/    - Загрузить работу на проект
POST   /api/projects/<id>/vote/      - Проголосовать за работу
```

**Аналитика:**
```
GET    /api/analytics/risk/          - Список студентов в зоне риска
GET    /api/analytics/attendance/    - Отчет посещаемости
GET    /api/analytics/revenue/       - Финансовый отчет
GET    /api/analytics/engagement/    - Анализ вовлеченности
```

**Уведомления:**
```
GET    /api/notifications/           - Мои уведомления
POST   /api/notifications/mark-read/ - Отметить как прочитано
POST   /api/telegram/connect/        - Привязать Telegram
GET    /api/telegram/status/         - Статус Telegram интеграции
```

#### 3.4 Реализация логики автоматизации

**Смарт-отработка пропусков:**
- Еженедельно в пн: публикация доступных слотов преподавателями
- Родитель выбирает слот для ребенка
- Система отправляет напоминание в Telegram
- После отработки: автоматическое обновление журнала
- Уведомление родителю с подтверждением

**Антиотток-аналитика:**
- Расчет скоринга риска для каждого ученика (посещаемость, оплата, активность)
- Фоновая задача Celery для ежедневного обновления
- Уведомление менеджеру при рисках
- Автоматическая генерация списка для CRM

**Еженедельная лента проектов:**
- Каждый пн: публикация проектов на неделю
- Ученики загружают работы до пт
- Автоматическое голосование в сб-вс
- Определение лучшей работы и уведомление автора

**Генерация PDF-портфолио:**
- Celery задача для асинхронной генерации
- Сбор всех работ ученика, оценок, достижений
- Форматирование в PDF с брендингом школы
- Сохранение в файловое хранилище или отправка по email

#### 3.5 Интеграции и сервисы

**Telegram Bot API:**
- Отправка уведомлений родителям
- Отправка уведомлений преподавателям
- Подтверждение действий через инлайн-кнопки

**Email-уведомления (опционально):**
- Счета и платежи
- Еженедельные отчеты

**Файловое хранилище:**
- Загрузка работ студентов
- Генерированные PDF-файлы
- Документы и материалы

#### 3.6 Тестирование backend

**Unit-тесты:**
- Тесты всех моделей
- Тесты сервисов логики
- Тесты валидаторов

**Integration-тесты:**
- Тесты API endpoints
- Тесты взаимодействия компонентов
- Тесты интеграций (Telegram, file storage)

**Performance-тесты:**
- Нагрузочное тестирование API
- Оптимизация медленных запросов

---

### 2.4 Этап 4: Разработка Frontend (Неделя 9-12)

#### 4.1 Структура React приложения

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── common/              # Переиспользуемые компоненты
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Buttons.jsx
│   │   │
│   │   ├── auth/                # Компоненты аутентификации
│   │   │   ├── LoginForm.jsx
│   │   │   ├── RegisterForm.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   │
│   │   ├── dashboard/           # Дашборды по ролям
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── TeacherDashboard.jsx
│   │   │   ├── ParentDashboard.jsx
│   │   │   └── StudentDashboard.jsx
│   │   │
│   │   ├── users/               # Управление пользователями
│   │   │   ├── UserList.jsx
│   │   │   ├── UserForm.jsx
│   │   │   └── UserProfile.jsx
│   │   │
│   │   ├── courses/             # Курсы и группы
│   │   │   ├── CourseList.jsx
│   │   │   ├── CourseForm.jsx
│   │   │   ├── GroupList.jsx
│   │   │   └── GroupForm.jsx
│   │   │
│   │   ├── schedule/            # Расписание
│   │   │   ├── ScheduleView.jsx
│   │   │   ├── ScheduleForm.jsx
│   │   │   └── LessonDetails.jsx
│   │   │
│   │   ├── attendance/          # Посещаемость
│   │   │   ├── AttendanceTable.jsx
│   │   │   ├── MarkAttendance.jsx
│   │   │   └── MakeUpList.jsx
│   │   │
│   │   ├── finance/             # Финансы
│   │   │   ├── InvoiceList.jsx
│   │   │   ├── PaymentForm.jsx
│   │   │   └── FinanceReport.jsx
│   │   │
│   │   ├── portfolio/           # Портфолио
│   │   │   ├── PortfolioView.jsx
│   │   │   ├── ProjectFeed.jsx
│   │   │   ├── ProjectSubmit.jsx
│   │   │   └── VotingWidget.jsx
│   │   │
│   │   └── analytics/           # Аналитика
│   │       ├── RiskAnalysis.jsx
│   │       ├── AttendanceReport.jsx
│   │       ├── RevenueChart.jsx
│   │       └── EngagementChart.jsx
│   │
│   ├── pages/                   # Страницы приложения
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── NotFound.jsx
│   │   └── ...
│   │
│   ├── services/                # API сервисы
│   │   ├── api.js               # Конфигурация axios
│   │   ├── authService.js       # Методы аутентификации
│   │   ├── userService.js       # Методы работы с пользователями
│   │   ├── courseService.js     # Методы работы с курсами
│   │   ├── attendanceService.js # Методы работы с посещаемостью
│   │   └── ...
│   │
│   ├── context/                 # React Context
│   │   ├── AuthContext.js       # Контекст аутентификации
│   │   └── NotificationContext.js# Контекст уведомлений
│   │
│   ├── hooks/                   # Кастомные хуки
│   │   ├── useAuth.js
│   │   ├── useApi.js
│   │   └── ...
│   │
│   ├── styles/                  # Глобальные стили
│   │   ├── variables.css
│   │   ├── global.css
│   │   └── ...
│   │
│   ├── utils/                   # Утилиты
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── ...
│   │
│   ├── App.jsx                  # Главный компонент
│   └── index.js                 # Точка входа
│
├── package.json
└── README.md
```

#### 4.2 Основные экраны и функциональность

**Экран входа:**
- Форма логина/регистрации
- Восстановление пароля
- Выбор роли при регистрации

**Дашборд администратора:**
- Обзор школы (статистика, ключевые метрики)
- Управление пользователями
- Управление курсами и группами
- Финансовая аналитика
- Экспорт отчетов

**Дашборд преподавателя:**
- Мое расписание
- Журнал посещаемости
- Список слотов для отработок
- Голосование за лучшие работы
- Уведомления о пропусках

**Дашборд родителя:**
- Статус ребенка (курсы, оценки, посещаемость)
- Запрос на отработку
- История платежей и счета
- Портфолио ребенка (лента работ)
- Уведомления и наблюдения

**Дашборд ученика:**
- Мои курсы
- Расписание занятий
- Портфолио и достижения
- Лента проектов текущей недели
- Отправка своих работ
- Голосование за лучшую работу

**Страница портфолио:**
- Все работы ученика по неделям
- Результаты голосований
- Сертификаты и достижения
- Кнопка скачивания PDF-портфолио

#### 4.3 UX/UI дизайн

**Стек:**
- React 18+
- Bootstrap 5 или Tailwind CSS
- Chart.js для графиков и диаграмм
- React Router для маршрутизации
- Axios для HTTP запросов
- React Query для кеширования данных

**Принципы дизайна:**
- Мобильный-first подход
- Интуитивный интерфейс для всех ролей
- Брендинг школы KiberOne
- Доступность (a11y)

---

### 2.5 Этап 5: Интеграция и тестирование (Неделя 13-14)

#### 5.1 Интеграционное тестирование

**Сценарии:**
- Полный цикл: регистрация → добавление в группу → отработка → платеж → портфолио
- Еженедельные сценарии: публикация проектов → отправка работ → голосование
- Интеграция с Telegram

**Инструменты:**
- Postman/Insomnia для тестирования API
- Jest + React Testing Library для frontend

#### 5.2 Тестирование производительности

**Задачи:**
- Нагрузочное тестирование API (Apache JMeter, Locust)
- Оптимизация запросов БД
- Кеширование на уровне API
- Оптимизация frontend (bundle size, lazy loading)

#### 5.3 Тестирование безопасности

**Задачи:**
- Проверка HTTPS/TLS
- Валидация входных данных
- Защита от SQL injection
- Защита CSRF токенами
- Разграничение доступа (RBAC)
- Защита персональных данных минор

---

### 2.6 Этап 6: Развертывание и запуск (Неделя 15)

#### 6.1 Подготовка production окружения

**Инфраструктура:**
- Сервер (VPS/облако)
- Nginx как reverse proxy
- PostgreSQL production instance
- Redis для кеширования (опционально)
- Файловое хранилище (lokаль или облако)

#### 6.2 Dockerизация

**Создание Dockerfile:**

```dockerfile
# Backend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "--workers=4", "--bind=0.0.0.0:8000", "config.wsgi:application"]

# Frontend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=0 /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Docker Compose для production:**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: kiberone
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  backend:
    build: ./backend
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/kiberone
      SECRET_KEY: secret_key
      DEBUG: 'False'
    ports:
      - "8000:8000"
  
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

#### 6.3 CI/CD pipeline (GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend tests
        run: cd backend && python -m pytest
      - name: Run frontend tests
        run: cd frontend && npm test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          echo "${{ secrets.DEPLOY_KEY }}" > key
          chmod 600 key
          ssh -i key user@server 'cd /app && git pull && docker-compose up -d'
```

#### 6.4 Мониторинг и логирование

**Задачи:**
- Настройка логирования (Sentry или ELK)
- Мониторинг производительности
- Оповещения об ошибках
- Регулярные бэкапы БД

---

### 2.7 Этап 7: Пилотный запуск и доработка (Неделя 16-17)

**Мероприятия:**
- Запуск на одной группе/филиале
- Сбор обратной связи от пользователей
- Баг-фиксинг и оптимизация
- Документирование для поддержки

---

### 2.8 Этап 8: Полный запуск и поддержка (Неделя 18+)

**Задачи:**
- Развертывание на все филиалы
- Обучение пользователей
- Передача в техподдержку
- Планирование v2 с новыми функциями

---

## 3. Техстек и инструменты

### Backend
| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Framework | Django | 4.2+ |
| REST API | Django REST Framework | 3.14+ |
| Database | PostgreSQL | 14+ |
| Task Queue | Celery | 5.3+ |
| Message Broker | Redis | 7+ |
| WSGI | Gunicorn | 20.1+ |
| Testing | pytest | 7.4+ |
| Code Quality | Black, Flake8 | latest |

### Frontend
| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Library | React | 18+ |
| Routing | React Router | 6+ |
| HTTP Client | Axios | 1.4+ |
| State | React Context/Redux | - |
| UI Framework | Bootstrap 5 / Tailwind | 5.3 / 3+ |
| Charts | Chart.js | 4+ |
| Build Tool | Create React App / Vite | - |

### Infrastructure
| Компонент | Технология |
|-----------|-----------|
| Container | Docker |
| Orchestration | Docker Compose |
| Reverse Proxy | Nginx |
| VCS | Git / GitHub |
| CI/CD | GitHub Actions |
| Database Admin | pgAdmin / DBeaver |

### External Integrations
| Сервис | Назначение |
|--------|-----------|
| Telegram Bot API | Уведомления |
| SMTP | Email |
| Cloud Storage (опционально) | Файлы |

---

## 4. Ресурсы и команда

### Состав команды
- **1x Backend Developer** (Django, PostgreSQL, Celery)
- **1x Frontend Developer** (React, UX/UI)
- **1x DevOps/Sysadmin** (Docker, deployment, monitoring)
- **1x QA Engineer** (тестирование, documentation)
- **1x Project Manager** (координация, feedback)

### Оборудование
- 2-3 компьютера для разработки (OS: Windows/Mac/Linux)
- VPS/облаком сервер для production (4GB RAM, 2 CPU, 50GB SSD)
- PostgreSQL хостинг или управляемый сервис (опционально)

### Прочее
- IDE: VS Code (backend + frontend)
- Tools: Git, Postman, Docker Desktop, pgAdmin, DBeaver
- Communication: Zoom, Telegram
- Documentation: Confluence, GitHub Wiki

---

## 5. Графики и сроки

| Этап | Задачи | Сроки | Статус |
|------|--------|-------|--------|
| 1 | Подготовка и планирование | Нед 1-2 | ✓ Завершено |
| 2 | Инфраструктура | Нед 3 | ⏳ В работе |
| 3 | Backend разработка | Нед 4-8 | ⏳ В работе |
| 4 | Frontend разработка | Нед 9-12 | ⏳ Планы |
| 5 | Тестирование | Нед 13-14 | ⏳ Планы |
| 6 | Развертывание | Нед 15 | ⏳ Планы |
| 7 | Пилот и доработка | Нед 16-17 | ⏳ Планы |
| 8 | Полный запуск | Нед 18+ | ⏳ Планы |

**Общий срок:** 18-20 недель (4.5-5 месяцев)

---

## 6. Риски и смягчение

| Риск | Вероятность | Воздействие | Смягчение |
|------|------------|-----------|----------|
| Требования изменяются | Средняя | Высокое | Agile подход, регулярные встречи |
| Перфекционизм в дизайне | Высокая | Среднее | MVP первый, фичи потом |
| Проблемы с производительностью | Средняя | Высокое | Load testing, кеширование |
| Отсутствие тестирования на production | Высокая | Критична | Обязательны staging环境 |
| Проблемы с документированием API | Средняя | Среднее | Swagger/OpenAPI от начала |

---

## 7. Критерии успеха проекта

✅ **Функциональность:**
- Все модули работают (пользователи, курсы, посещаемость, финансы, портфолио)
- API полностью документирован
- Frontend покрывает все основные сценарии
- Telegram интеграция работает

✅ **Качество:**
- Test coverage ≥ 80%
- Нет критических багов
- Время отклика API < 200ms
- Uptime ≥ 99.5% в production

✅ **Пользовательский опыт:**
- Система используется всеми ролями
- Net Promoter Score (NPS) > 50
- Положительный feedback от тестирования

✅ **Поддержка:**
- Документация полная и актуальная
- Команда поддержки обучена
- Готовность к масштабированию

---

## 8. Дальнейшее развитие

**v2 и последующие версии:**
- Мобильное приложение (React Native)
- Интеграция с платежными системами (Yandex.Kassa, Stripe)
- Продвинутая аналитика и dashboards
- Machine Learning для предсказания оттока
- 1С интеграция для бухгалтерии
- WhatsApp интеграция
- Видео-лекции и облако хранилище

---

## 9. KPI и метрики для отслеживания

**Метрики разработки:**
- Скорость разработки (story points/неделю)
- Количество багов на 1000 строк кода
- Coverage тестами
- Code Quality Score (Sonarqube)

**Метрики продукта:**
- DAU/MAU (active users)
- % используемых фич
- Время до первого успешного действия
- Retention rate

**Метрики системы:**
- API response time (P50, P95, P99)
- Database query time
- Uptime
- Error rate
- Server resource utilization

---

## 10. Контакты и ответственные

| Роль | Ответственный | Контакт |
|------|--------------|---------|
| Project Manager | [ФИО] | [email] |
| Backend Lead | [ФИО] | [email] |
| Frontend Lead | [ФИО] | [email] |
| DevOps | [ФИО] | [email] |
| QA Lead | [ФИО] | [email] |

---

**Дата создания:** Апрель 2026  
**Версия:** 1.0  
**Статус:** Активный план разработки
