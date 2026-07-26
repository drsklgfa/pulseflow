.PHONY: install validate test build up down reset logs manifest

install:
	npm install --no-audit --no-fund
	npm run prisma:generate

validate:
	npm run validate:repo

test:
	npm run typecheck
	npm run test:coverage

build:
	npm run build

up:
	docker compose up --build

down:
	docker compose down

reset:
	docker compose down -v --remove-orphans

logs:
	docker compose logs -f api worker

manifest:
	npm run manifest
