# Makefile

# Variables
BACKEND_DIR=fastapi_backend
FRONTEND_DIR=nextjs-frontend
DOCKER_COMPOSE=docker compose

# Help
.PHONY: help
help:
	@echo "Available commands:"
	@awk '/^[a-zA-Z_-]+:/{split($$1, target, ":"); print "  " target[1] "\t" substr($$0, index($$0,$$2))}' $(MAKEFILE_LIST)

# Backend commands
.PHONY: start-backend test-backend create-start-script

start-backend: ## Start the backend server with FastAPI and hot reload
	cd $(BACKEND_DIR) && uvicorn fastapi_backend.main:app --reload --host 0.0.0.0 --port 8000

create-start-script: ## Create a startup script for the backend
	echo '#!/bin/bash\n\necho "Starting Single-Cell Analysis API..."\n\nPORT=$${PORT:-8000}\nHOST=$${HOST:-0.0.0.0}\nLOG_LEVEL=$${LOG_LEVEL:-info}\n\nuvicorn fastapi_backend.main:app --host $$HOST --port $$PORT --reload --log-level $$LOG_LEVEL' > $(BACKEND_DIR)/start.sh && chmod +x $(BACKEND_DIR)/start.sh

test-backend: ## Run backend tests using pytest
	cd $(BACKEND_DIR) && uv run pytest


# Frontend commands
.PHONY: start-frontend test-frontend

start-frontend: ## Start the frontend server with pnpm and hot reload
	cd $(FRONTEND_DIR) && ./start.sh

test-frontend: ## Run frontend tests using npm
	cd $(FRONTEND_DIR) && pnpm run test


# Docker commands
.PHONY: docker-backend-shell docker-frontend-shell docker-build docker-build-backend \
        docker-build-frontend docker-start-backend docker-start-frontend docker-up-test-db \
        docker-migrate-db docker-db-schema docker-test-backend docker-test-frontend


docker-backend-shell: ## Access the backend container shell
	$(DOCKER_COMPOSE) run --rm backend sh

docker-frontend-shell: ## Access the frontend container shell
	$(DOCKER_COMPOSE) run --rm frontend sh

docker-build: ## Build all the services
	$(DOCKER_COMPOSE) build --no-cache

docker-build-backend: ## Build the backend container with no cache
	$(DOCKER_COMPOSE) build backend --no-cache

docker-build-frontend: ## Build the frontend container with no cache
	$(DOCKER_COMPOSE) build frontend --no-cache

docker-start-backend: ## Start the backend container
	$(DOCKER_COMPOSE) up backend

docker-start-frontend: ## Start the frontend container
	$(DOCKER_COMPOSE) up frontend

docker-up-test-db: ## Start the test database container
	$(DOCKER_COMPOSE) up db_test

docker-migrate-db: ## Run database migrations using Alembic
	$(DOCKER_COMPOSE) run --rm backend alembic upgrade head

docker-db-schema: ## Generate a new migration schema. Usage: make docker-db-schema migration_name="add users"
	$(DOCKER_COMPOSE) run --rm backend alembic revision --autogenerate -m "$(migration_name)"

docker-test-backend: ## Run tests for the backend
	$(DOCKER_COMPOSE) run --rm backend pytest

docker-test-frontend: ## Run tests for the frontend
	$(DOCKER_COMPOSE) run --rm frontend pnpm run test

# Custom commands for dataprep and bioflow
.PHONY: dataprep-init bioflow-demo

dataprep-init: ## Initialize dataprep environment
	cd $(BACKEND_DIR) && python -m dataprep.cli init

bioflow-demo: ## Run bioflow demo
	cd $(BACKEND_DIR) && python bioflow_demo.py