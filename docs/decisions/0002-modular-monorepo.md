# ADR 0002: Modular monorepo

- Status: Accepted
- Date: 2026-07-25

## Context

The portfolio must show multiple runtime processes without forcing reviewers to assemble unrelated repositories.

## Decision

Use npm workspaces with separate web, API and worker applications plus shared contracts and database packages.

## Consequences

- Atomic changes can update contracts and consumers together.
- One CI workflow can validate the entire system.
- Docker images remain independently deployable.
- Workspace installation is larger than a single-service repository.
