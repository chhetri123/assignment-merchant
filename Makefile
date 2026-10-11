.DEFAULT_GOAL := up
SHELL := /bin/bash
.PHONY: up down logs test

up: ## Create .env if missing, then build and start the whole stack
	@test -f .env || sed \
		-e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$$(openssl rand -hex 32)|" \
		-e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$$(openssl rand -hex 32)|" \
		-e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$$(openssl rand -hex 32)|" \
		-e "s|^DB_PASSWORD=.*|DB_PASSWORD=$$(openssl rand -hex 16)|" \
		.env.example > .env
	docker compose up -d --build
	@echo
	@echo "Swagger   http://localhost:3000/docs"
	@echo "Health    http://localhost:3000/api/health/ready"
	@echo "Sign in   sales@merchant.test / admin@merchant.test / reviewer@merchant.test  (ChangeMe123!)"

down: ## Stop the stack and remove its data
	docker compose down -v

logs: ## Follow the API logs
	docker compose logs -f api

test: ## Run unit and integration tests (Postgres and Redis must be up)
	docker compose up -d postgres redis
	npm ci
	npm run test
	npm run test:e2e
