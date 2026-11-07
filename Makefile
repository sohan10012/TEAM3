PY ?= python3
VENV ?= .venv
BIN = $(VENV)/bin

.PHONY: setup env install backend frontend dev test test-backend test-frontend lint typecheck openapi screenshots db-backup db-reset db-init ci doctor

db-init:
	cd backend && ../$(BIN)/python -m app.db.init_db

doctor:
	$(BIN)/python scripts/doctor.py

setup: env install

env:
	$(PY) scripts/bootstrap_env.py

install:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

backend:
	cd backend && ../$(BIN)/uvicorn app.main:app --host 127.0.0.1 --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@echo "Run 'make backend' and 'make frontend' in two terminals, then open http://localhost:5173"

test: test-backend test-frontend

test-backend:
	cd backend && ../$(BIN)/pytest -q --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm test

lint:
	cd backend && ../$(BIN)/ruff check app tests
	cd frontend && npm run lint

typecheck:
	cd backend && ../$(BIN)/mypy app
	cd frontend && npm run typecheck

openapi:
	$(BIN)/python scripts/export_openapi.py
	cd frontend && npm run gen:api

screenshots:
	$(BIN)/python scripts/capture_screenshots.py --email $$TRACETEST_ADMIN_EMAIL --password $$TRACETEST_ADMIN_PASSWORD

db-backup:
	$(BIN)/python scripts/db.py backup

db-reset:
	$(BIN)/python scripts/db.py reset

ci: lint typecheck test
