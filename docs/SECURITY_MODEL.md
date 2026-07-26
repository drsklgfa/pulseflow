# Security model

## Assets

- payment state and provider identifiers;
- customer name and e-mail;
- webhook payloads;
- notification history;
- administrative identities and audit events;
- provider credentials supplied at deployment time.

PulseFlow does not collect or store card numbers, security codes or bank credentials.

## Primary threats and controls

| Threat | Control |
| --- | --- |
| Forged webhook | HMAC/Stripe signature verification over raw bytes |
| Replay or duplicate event | Unique external event ID and idempotent handling |
| Duplicate checkout request | Hashed idempotency key with database uniqueness |
| Unauthorized mutation | Expiring signed tokens and ADMIN role guard |
| Password disclosure | Scrypt hash with random salt |
| Brute request volume | Per-client rate limit guard |
| Injection or over-posting | Prisma parameterization, DTO whitelist and forbidden unknown fields |
| Secret committed to Git | `.gitignore`, examples without real values and repository validator |
| Sensitive log data | Structured operational fields without credentials or message bodies |
| Infinite retry loop | Bounded attempts, exponential delay and dead-letter queue |
| Container signal loss | `dumb-init` and graceful shutdown hooks |
| Dependency vulnerability | Dependabot, dependency review and CodeQL |

## Authentication design

The project implements a compact HMAC-signed access token to keep the educational flow visible in the shared contracts package. It includes subject, e-mail, display name, role, issued time and expiry. A production organization may replace it with OIDC or an identity provider through the same guard boundary.

## Webhook verification

- Mock events use `x-pulseflow-signature` with HMAC-SHA256.
- Stripe events use the raw body and the `stripe-signature` timestamp/signature values.
- The timestamp tolerance rejects stale Stripe replays.
- Rejected events are persisted for security review without applying a payment transition.

## Production checklist

Before exposing the project publicly:

- replace all demo secrets and credentials;
- use TLS at the ingress;
- disable or restrict Failure Lab;
- apply a restrictive CORS allowlist;
- connect a managed secret store;
- establish retention and deletion rules for personal data;
- add centralized logs, alerts and incident response;
- review payment-provider and privacy obligations;
- test backups and restoration;
- perform organization-specific threat modeling and penetration testing.
