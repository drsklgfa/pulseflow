# Portfolio walkthrough

This five-minute walkthrough demonstrates the product and the engineering decisions behind it.

## 1. Open the overview

Point out the approval rate, processed volume, delivery rate, queue health and recent event stream. Explain that the same UI runs in a browser-only GitHub Pages mode and against the real Docker API.

## 2. Create a payment

Create a payment for `R$ 129,90`. The operation produces a pending record and a correlated timeline event. Repeat the API request with the same idempotency key in Swagger to demonstrate safe replay.

## 3. Process a successful provider event

Use Failure Lab to approve the payment with `NONE`. In Docker mode this performs HMAC verification, stores the webhook, enqueues a BullMQ job, lets the worker deliver through Mailpit and publishes realtime events.

## 4. Demonstrate resilience

Create another payment and select `FAIL_ONCE`. Explain exponential backoff and observe that the second attempt succeeds.

Create a third payment and select `FAIL_ALWAYS` or `TIMEOUT`. Show the terminal error, dead-letter count and manual retry action.

## 5. Demonstrate security

Run **Invalid signature**. The payment remains unchanged while the rejected webhook appears in the event list and audit context.

## 6. Open technical evidence

- Swagger documentation;
- architecture SVG and ADRs;
- Prisma constraints;
- unit/integration tests;
- CI, CodeQL and Pages workflows;
- Docker Compose health and startup ordering.

## Key portfolio message

PulseFlow is more than a CRUD dashboard. It shows how to make external events observable and reliable under duplicate delivery, retries and provider failure, while still being simple for a reviewer to run.
