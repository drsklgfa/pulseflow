# Changelog

All notable changes to PulseFlow are documented here.

## [1.0.1] - 2026-07-25

### GitHub Pages presentation

- Rebuilt the Pages workflow with automatic repository base-path detection.
- Updated official checkout and setup-node actions to v7.
- Corrected the Pages artifact upload action to v4.
- Added `.nojekyll`, SPA fallback and deployment metadata generation.
- Added PowerShell and Bash helpers that enable Pages with `build_type=workflow` and dispatch the workflow.
- Added a dedicated GitHub Pages operations guide and validator coverage.

## [1.0.0] - 2026-07-25

### Added

- Polished, responsive React operations dashboard with overview, payments, webhooks, queues, notifications, analytics, Failure Lab, audit and documentation views.
- Persistent standalone GitHub Pages demo with realistic state transitions and failure scenarios.
- Administrator authentication, role-based authorization, request correlation and rate limiting.
- Payment provider adapters for self-contained mock mode and optional Stripe sandbox mode.
- HMAC and Stripe webhook signature verification, replay protection and rejected-event persistence.
- PostgreSQL models for users, payments, notifications, webhooks, processing timeline and audit logs.
- BullMQ notification worker with exponential retries, provider adapters and dead-letter recovery.
- Mailpit local delivery, optional Resend adapter and outbound webhook support.
- Redis Pub/Sub and Socket.IO realtime event updates.
- Unit and integration test suites plus coverage artifacts.
- Docker Compose startup ordering, migration/seed setup service and health checks.
- GitHub Actions for CI, Pages, CodeQL, dependency review and tagged release archives.
- Dependabot, issue forms, pull-request template and CODEOWNERS.
- Architecture, testing, security, runbook, deployment, provider and portfolio documentation.
- Repository validation, TypeScript syntax validation, manifest generation and restore guide.

### Changed

- Upgraded the original v0.1.0 proof of concept into a complete portfolio edition.
- Standardized all workspaces and application metadata at version 1.0.0.
- Moved external integrations behind provider interfaces so the default stack needs no paid account.

### Removed

- Obsolete v0.1.0 simulation DTO and minimal service test that no longer matched the final architecture.

## [0.1.0] - 2026-07-25

### Added

- Initial monorepo, API, worker, web dashboard, PostgreSQL, Redis, Mailpit and basic CI structure.
