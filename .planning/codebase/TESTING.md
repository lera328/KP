# Testing

- No automated test suite was found in the repository.
- No `tests.py`, `test_*.py`, or `tests/` directories were found under the backend apps.
- No frontend test files or test runner configuration were found in `frontend/`.
- `frontend/package.json` defines only `dev`, `build`, and `preview` scripts; there is no test script.
- Backend `requirements.txt` does not include pytest, coverage, or Django test helper packages.
- Current verification appears to be manual or ad hoc only; there is no evidence of CI, test automation, or coverage reporting in the workspace.
- The codebase does contain validation and safety checks in application code:
  - serializer validation in attendance, finance, and users flows;
  - model-level `clean()` methods and unique constraints;
  - permission checks for authenticated/admin-only operations.
- These checks are runtime validation, not executed test coverage.
- No test data factories, fixtures, or mocks were found.
- No documented test commands were found in backend or frontend project files.
