# Phase 01: Verify Services - Plan

## Goal
Get the local Docker-based development stack into a healthy state and verify that the project can start end-to-end with Docker Desktop, Docker Compose, PostgreSQL, backend, and frontend.

## Scope
Included:
- Repair the local Docker Desktop / WSL2 environment if required.
- Verify `docker version`, `docker ps`, and `docker compose config`.
- Verify the compose file with the current `.env` values.
- Build and start the db, backend, and frontend services.
- Confirm the Django backend can run migrations in container startup.
- Confirm the Vite frontend starts and exposes port 5173.

Excluded:
- New application features.
- Business logic changes in backend apps.
- Frontend UI work beyond making the stack run.
- Deployment outside the local machine.

## Context
- `docker-compose.yml` already defines `db`, `backend`, and `frontend`.
- The compose file uses the `kiberone` project name.
- The backend image is Python 3.11 slim.
- The frontend image is Node 20 Alpine.
- Known blocker: Docker Desktop previously stalled on "Starting the Docker Engine..." and `docker ps` returned `500`.

## Tasks
1. **Stabilize Docker Desktop**
   - Ensure WSL2 and virtualization prerequisites are enabled.
   - Confirm Docker Desktop can reach the Linux engine.
   - If Docker internal distros are missing, restore them using the safest available reset path.

2. **Verify baseline CLI health**
   - Run `docker version` and confirm both client and server are available.
   - Run `docker ps` without errors.
   - Run `docker compose --env-file .env config` successfully.

3. **Validate compose inputs**
   - Confirm `.env` exists and matches `.env.example` for required keys.
   - Confirm no stale compose syntax warnings prevent startup.
   - Ensure the project name is set to avoid the previous empty project-name error.

4. **Start containers**
   - Build images with Docker Compose.
   - Start `db`, `backend`, and `frontend`.
   - Observe container logs for startup errors.

5. **Verify app readiness**
   - Confirm the backend is reachable on port 8000.
   - Confirm the frontend is reachable on port 5173.
   - Confirm PostgreSQL accepts connections from the backend container.

6. **Record outcome**
   - Document any environment fixes required.
   - Capture the exact commands that succeeded.
   - Note remaining blockers if the engine still fails to start.

## Verification
Pass criteria:
- `docker version` shows both Client and Server.
- `docker ps` returns successfully.
- `docker compose config` validates the stack.
- `docker compose up` starts all three services.
- Backend and frontend logs show normal startup.

If any command fails, capture the error and decide whether the issue is:
- Docker Desktop / WSL2 environment
- compose configuration
- image build/runtime issue

## Risks
- Docker Desktop may require admin rights or a PC reboot.
- WSL distributions may need repair or recreation.
- Backend may fail to migrate if PostgreSQL is not ready on first boot.
- Frontend may fail if npm dependencies are not installed during image build.

## Done
The phase is complete when the full local stack starts successfully or the remaining blocker is clearly isolated and documented.
