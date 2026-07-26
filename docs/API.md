# API and event flows

Base URL: `http://localhost:3333/api/v1`

Swagger UI: `http://localhost:3333/docs`

## Authentication

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@pulseflow.local",
  "password": "PulseFlow123!"
}
```

Use the returned token:

```http
Authorization: Bearer <accessToken>
```

## Main endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health/live` | Public | Process liveness |
| `GET` | `/health/ready` | Public | PostgreSQL and Redis readiness |
| `POST` | `/auth/login` | Public | Create an access token |
| `GET` | `/auth/me` | Authenticated | Current identity |
| `GET` | `/dashboard` | Authenticated | Operations summary |
| `GET` | `/analytics?days=7` | Authenticated | Time series and rates |
| `GET` | `/payments` | Authenticated | Paginated payments |
| `POST` | `/payments` | Admin | Create an idempotent payment |
| `GET` | `/payments/:id` | Authenticated | Full payment timeline |
| `POST` | `/payments/:id/cancel` | Admin | Cancel a pending payment |
| `GET` | `/webhooks` | Authenticated | Received and rejected events |
| `POST` | `/webhooks/:provider` | Public signed endpoint | Receive provider event |
| `GET` | `/notifications` | Authenticated | Notification attempts |
| `POST` | `/notifications/:id/retry` | Admin | Manual retry |
| `GET` | `/queues` | Authenticated | BullMQ metrics and policy |
| `POST` | `/queues/pause` | Admin | Pause a queue |
| `POST` | `/queues/resume` | Admin | Resume a queue |
| `POST` | `/lab/payments/:id/event` | Admin | Trigger a safe demo event |
| `POST` | `/lab/payments/:id/invalid-signature` | Admin | Demonstrate rejection |
| `GET` | `/audit` | Authenticated | Administrative audit trail |

## Idempotent payment creation

```http
POST /payments
Authorization: Bearer <token>
Idempotency-Key: checkout-order-1042
Content-Type: application/json

{
  "customerName": "Marina Costa",
  "customerEmail": "marina@example.com",
  "amount": 129.90,
  "currency": "BRL"
}
```

The same key returns the existing payment with `idempotentReplay: true`.

## Mock signed webhook

The request body must be signed with HMAC-SHA256 using `WEBHOOK_SECRET`. The signature is sent in `x-pulseflow-signature`.

```json
{
  "id": "mock_evt_unique_1042",
  "type": "payment.approved",
  "data": {
    "paymentId": "<pulseflow-payment-id>",
    "status": "APPROVED"
  }
}
```

The Failure Lab generates this request internally so evaluators do not need to calculate signatures.

## Realtime channel

Socket.IO namespace: `/events`

Event name: `pulseflow:event`

```json
{
  "id": "uuid",
  "type": "notification.sent",
  "occurredAt": "2026-07-25T18:00:00.000Z",
  "correlationId": "uuid",
  "payload": {
    "notificationId": "uuid",
    "paymentId": "uuid"
  }
}
```

## Request collection

Use [`docs/api/pulseflow.http`](api/pulseflow.http) with an HTTP client extension, or use Swagger directly.
