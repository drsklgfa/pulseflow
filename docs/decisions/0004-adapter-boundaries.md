# ADR 0004: External providers behind adapters

- Status: Accepted
- Date: 2026-07-25

## Context

The repository must run without paid credentials while remaining credible for a real sandbox integration.

## Decision

Define minimal payment and notification provider interfaces. Ship local mock/SMTP implementations and optional Stripe/Resend implementations.

## Consequences

- Local evaluation is deterministic.
- Real providers can be enabled with configuration.
- Provider-specific advanced features remain outside the common interface until needed.
