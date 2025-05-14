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
.PHONY: start-backend test-backend test-bioflow deploy-backend-railway

start-backend: ## Start the backend server with FastAPI and hot reload
	cd $(BACKEND_DIR) && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info

test-backend: ## Run backend tests using pytest
	cd $(BACKEND_DIR) && uv run pytest

test-bioflow: ## Run bioflow-specific tests
	cd $(BACKEND_DIR) && PYTHONPATH=$$PYTHONPATH:$(PWD)/$(BACKEND_DIR) uv run pytest tests/test_bioflow_api.py tests/test_bioflow_processor.py -v dataprep/biodata/tests/test_analysis_components.py dataprep/biodata/tests/test_analysis_service.py dataprep/biodata/tests/test_processing_queue.py dataprep/biodata/tests/test_result_formatters.py -v

deploy-backend-railway: ## Deploy backend to Railway
	cd $(BACKEND_DIR) && railway up

# Frontend commands
.PHONY: start-frontend test-frontend

start-frontend: ## Start the frontend server with pnpm and hot reload
	cd $(FRONTEND_DIR) && ./start.sh

test-frontend: ## Run frontend tests using npm
	cd $(FRONTEND_DIR) && pnpm run test


# Docker commands
.PHONY: docker-backend-shell docker-frontend-shell docker-build docker-build-backend \
        docker-build-frontend docker-start-backend docker-start-frontend docker-up docker-up-detached \
        docker-up-backend docker-up-frontend docker-down docker-up-test-db \
        docker-logs-frontend docker-logs-backend docker-logs \
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

docker-start-backend: ## Start the backend container in the foreground
	-$(DOCKER_COMPOSE) stop backend
	$(DOCKER_COMPOSE) up backend

docker-start-frontend: ## Start the frontend container in the foreground and always show logs
	-$(DOCKER_COMPOSE) stop frontend
	$(DOCKER_COMPOSE) up frontend

docker-up: ## Start all containers in the foreground
	$(DOCKER_COMPOSE) up

docker-up-detached: ## Start all containers in the background
	$(DOCKER_COMPOSE) up -d

docker-up-backend: ## Start the backend container and its dependencies in the background
	$(DOCKER_COMPOSE) up -d db
	$(DOCKER_COMPOSE) up -d backend

docker-up-frontend: ## Start the frontend container in the background
	$(DOCKER_COMPOSE) up -d frontend

docker-down: ## Stop and remove all containers
	$(DOCKER_COMPOSE) down

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

docker-logs-frontend: ## View logs of the frontend container
	$(DOCKER_COMPOSE) logs -f frontend

docker-logs-backend: ## View logs of the backend container
	$(DOCKER_COMPOSE) logs -f backend

docker-logs: ## View logs of all containers
	$(DOCKER_COMPOSE) logs -f

# Custom commands for dataprep and bioflow
.PHONY: dataprep-init bioflow-demo

dataprep-init: ## Initialize dataprep environment
	cd $(BACKEND_DIR) && python -m dataprep.cli init

bioflow-demo: ## Run bioflow demo
	cd $(BACKEND_DIR) && python bioflow_demo.py