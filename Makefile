.PHONY: dev build test lint migrate backup

dev:
	docker compose up --build

build:
	docker compose build

test:
	docker compose run --rm api pytest

lint:
	docker compose run --rm api ruff check .

migrate:
	docker compose run --rm api alembic upgrade head

backup:
	docker compose --profile tools run --rm backup

