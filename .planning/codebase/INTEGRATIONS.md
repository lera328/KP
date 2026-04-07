# Integrations

- Database integration: PostgreSQL via Django `DATABASES` config and the `db` service in Docker Compose.
- Authentication integration: Django auth plus DRF session authentication and JWT via SimpleJWT.
- Frontend-backend integration: React app calls backend REST endpoints under `http://localhost:8000/api` by default.
- API consumption pattern: browser `fetch` requests with `Authorization: Bearer <access_token>` headers when a token is present.
- Token storage: access and refresh tokens are stored in browser `localStorage`.
- Backend API endpoints exposed: health check, auth, users, courses, attendance, finance.
- Auth endpoints exposed: session login, logout, profile, token obtain, token refresh.
- Finance endpoints are mounted under `/api/finance/` and exposed through DRF routers.
- Deployment/container integration: Docker Compose orchestrates `db`, `backend`, and `frontend` services.
- Backend container command runs migrations and starts Django dev server on `0.0.0.0:8000`.
- Frontend container command runs Vite dev server on `0.0.0.0:5173`.
- Notable external dependencies: Bootstrap for UI, PostgreSQL for persistence, JWT for auth; no other third-party service integrations were found in the current codebase.