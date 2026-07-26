# ADR 0001: Demo-first, deployable architecture

- Status: Accepted
- Date: 2026-07-25

## Context

The portfolio must be useful from GitHub without requiring a paid provider or a permanently hosted backend. It must also preserve a credible path to real sandbox integrations.

## Decision

Ship two presentation modes over the same product language:

- a persistent browser-only GitHub Pages demo;
- a full Docker stack using mock payment and local SMTP adapters by default.

Provider interfaces preserve optional Stripe and Resend integration boundaries.

## Consequences

- Anyone can evaluate the product without creating external accounts.
- GitHub Pages remains a visual, interactive portfolio artifact.
- The complete backend flow is available locally with PostgreSQL, Redis and a worker.
- The static demo is explicitly marked and is not presented as financial processing.
