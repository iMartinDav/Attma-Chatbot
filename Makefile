# Makefile

# Variables
FRONTEND_DIR=nextjs-frontend
DOCKER_COMPOSE=docker compose

# Help
.PHONY: help
help:
	@echo "Available commands:"
	@awk '/^[a-zA-Z_-]+:/{split($$1, target, ":"); print "  " target[1] "\t" substr($$0, index($$0,$$2))}' $(MAKEFILE_LIST)

# Frontend commands
.PHONY: start-frontend test-frontend

start-frontend: ## Start the frontend server with bun and hot reload
	cd $(FRONTEND_DIR) && ./start.sh

test-frontend: ## Run frontend tests
	cd $(FRONTEND_DIR) && bun run test


# Docker commands
.PHONY: docker-frontend-shell docker-build docker-build-frontend docker-start-frontend \
        docker-up docker-up-detached docker-up-frontend docker-down \
        docker-logs-frontend docker-logs docker-test-frontend

docker-frontend-shell: ## Access the frontend container shell
	$(DOCKER_COMPOSE) run --rm frontend sh

docker-build: ## Build all the services
	$(DOCKER_COMPOSE) build --no-cache

docker-build-frontend: ## Build the frontend container with no cache
	NEXT_TELEMETRY_DISABLED=1 DOCKER_BUILD=true $(DOCKER_COMPOSE) build frontend --no-cache

docker-start-frontend: ## Start the frontend container in the foreground and always show logs
	-$(DOCKER_COMPOSE) stop frontend
	$(DOCKER_COMPOSE) up frontend

docker-up: ## Start all containers in the foreground
	$(DOCKER_COMPOSE) up

docker-up-detached: ## Start all containers in the background
	$(DOCKER_COMPOSE) up -d

docker-up-frontend: ## Start the frontend container in the background
	$(DOCKER_COMPOSE) up -d frontend

docker-down: ## Stop and remove all containers
	$(DOCKER_COMPOSE) down

docker-test-frontend: ## Run tests for the frontend
	$(DOCKER_COMPOSE) run --rm frontend bun run test

docker-logs-frontend: ## View logs of the frontend container
	$(DOCKER_COMPOSE) logs -f frontend

docker-logs: ## View logs of all containers
	$(DOCKER_COMPOSE) logs -f
