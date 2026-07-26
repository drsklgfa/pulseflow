# Testing strategy

PulseFlow treats tests as architecture evidence rather than a single percentage.

## Test layers

### Unit tests

- amount, currency and state-transition rules;
- idempotency key generation;
- access-token creation and verification;
- password hashing;
- webhook signatures and timestamp tolerance;
- payment and notification mock providers;
- notification templates;
- retry failure modes.

### Integration tests

The API integration suite uses real PostgreSQL and Redis services provisioned by GitHub Actions. It verifies:

1. readiness checks;
2. administrator login;
3. protected-route rejection;
4. payment creation;
5. request idempotency;
6. a signed mock provider event;
7. payment transition and webhook persistence;
8. notification creation and BullMQ enqueueing;
9. timeline growth.

### Build and infrastructure checks

- strict TypeScript for every workspace;
- Prisma generation and migration deployment;
- deterministic seed;
- production builds for API, worker and web;
- Docker Compose schema resolution;
- repository structure, YAML/JSON and secret-pattern validation.

## Local commands

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run typecheck
npm test
npm run test:coverage
RUN_INTEGRATION=true npm run test:integration
npm run build
npm run validate:repo
```

The integration suite is skipped unless `RUN_INTEGRATION=true`, preventing accidental failures when PostgreSQL and Redis are not available.

## CI services

The workflow uses disposable `postgres:16-alpine` and `redis:7-alpine` service containers. Each run starts from a clean environment, deploys migrations and seeds fixtures before tests.

## Coverage policy

Coverage reports are uploaded as a workflow artifact. A hard global percentage is intentionally not used in v1.0.0 because a high number can reward low-value tests; critical security and state-transition modules are explicitly covered instead. A future team can add per-module thresholds after a stable baseline is measured in CI.
