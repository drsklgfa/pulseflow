# ADR 0003: PostgreSQL as business source of truth

- Status: Accepted
- Date: 2026-07-25

## Context

Redis is required for queue semantics but queue retention alone is insufficient for business audit and recovery.

## Decision

Persist payment, webhook, notification, timeline and audit state in PostgreSQL. Redis owns delivery coordination and realtime transport only.

## Consequences

- Queue state can be rebuilt from durable business records.
- Operations queries and audit history remain relational.
- Side effects require careful transaction and idempotency boundaries.
