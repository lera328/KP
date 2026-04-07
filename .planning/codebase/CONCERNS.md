# CONCERNS

## Operational blockers
- Frontend login flow does not match backend auth flow.
- `frontend/src/components/LoginForm.jsx` sends an email field, while `backend/apps/users/views.py` authenticates by `username`.
- `frontend/src/context/AuthContext.jsx` expects `response.access`, but `session_login_view` returns only a success message.
- `frontend/src/services/api.js` defaults to JWT-style bearer auth, but the main login path creates a Django session.

## Environment and deployment
- `frontend/src/services/api.js` reads `process.env.REACT_APP_API_URL`, which is not the Vite runtime pattern used by this frontend.
- `docker-compose.yml` starts the backend with `manage.py migrate` followed by `runserver`; there is no separate production server process in the current setup.
- `backend/config/settings.py` falls back to `unsafe-dev-key` when `DJANGO_SECRET_KEY` is missing.
- `DEBUG` defaults to on unless `DJANGO_DEBUG=0` is set.
- `docker-compose.yml` exposes PostgreSQL on host port `5432`.

## Dependency concerns
- JWT support is installed in Python dependencies, but the frontend has no working token acquisition path through the current login form.
- `frontend/src/services/api.js` defines `refreshToken()`, but the app does not use refresh logic anywhere in the current flow.
- No automated tests were found in the repository.

## Data integrity concerns
- `backend/apps/attendance/models.py` defines `MakeUpRequest.clean()`, but the method raises `ValueError` instead of `ValidationError`, and the serializer paths do not call model validation.
- Attendance marking accepts raw `lesson_id` and `student_id` values with no current check that the student belongs to the lesson group.
- Makeup completion updates a request by ID with no current validation that the completed record matches the same student, lesson, or absence record.
- `backend/apps/finance/views.py` adds `Payment.amount` to `Subscription.remaining_lessons`, but `amount` is a decimal field while `remaining_lessons` is an integer field.
- Subscription payment updates are not wrapped in an explicit transaction in the view layer.
- Group creation accepts `student_ids` and `teacher_ids` without current role validation for the referenced users.
- User creation uses only roles that already exist in the database; missing role codes are silently ignored.

## Missing pieces
- The React app still contains placeholder pages for admin, teacher, parent, and student sections.
- `frontend/src/components/Dashboard.jsx` routes to multiple screens that are not implemented yet.
- There is no evidence of pagination, search, or filtering on the current list endpoints.
- Several API endpoints are broad list/create endpoints with minimal object-level restrictions.
