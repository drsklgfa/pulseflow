# Operations runbook

## Health checks

- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`
- Web container: `GET /health`
- Mailpit UI: `http://localhost:8025`

Readiness fails when PostgreSQL or Redis cannot be reached.

## Start

```bash
docker compose up --build
```

The `setup` service deploys migrations and performs an idempotent seed. API and worker start only after setup completes successfully.

## Inspect

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f setup
```

Worker logs are JSON-shaped for completed and failed jobs.

## Common recovery actions

### API is unhealthy

1. Check `setup` exit status.
2. Inspect PostgreSQL and Redis health.
3. Verify `DATABASE_URL` and `REDIS_URL`.
4. Run `docker compose restart api` after dependencies are healthy.

### Jobs are waiting

1. Confirm `worker` is running.
2. Check whether the queue was paused from the dashboard.
3. Inspect worker logs for provider failures.
4. Confirm Mailpit or the selected provider is reachable.

### Jobs are in dead letter

1. Open **Notifications** or **Queues**.
2. Inspect the final error and attempts.
3. Correct provider configuration.
4. Retry the individual notification from the UI.

Manual retry changes the job identifier and records an audit event.

### Reset demo data

```bash
docker compose down -v --remove-orphans
docker compose up --build
```

For the GitHub Pages demo, use **Reset workspace** in the interface or clear site storage.

## Backup considerations

The local compose stack stores PostgreSQL and Redis in named volumes. A production deployment should use managed backups, point-in-time recovery and tested restore procedures. Redis contains queue state but PostgreSQL remains the business source of truth.

## Safe shutdown

Node containers use `dumb-init`. The worker listens for `SIGTERM` and `SIGINT`, closes BullMQ, Redis and Prisma connections, then exits.
