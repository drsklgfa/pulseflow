# Provider configuration

## Default local providers

```env
PAYMENT_PROVIDER=mock
NOTIFICATION_PROVIDER=smtp
SMTP_HOST=mailpit
SMTP_PORT=1025
```

This mode is complete and requires no external account.

## Stripe sandbox adapter

```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=<sandbox secret>
STRIPE_WEBHOOK_SECRET=<endpoint signing secret>
```

Configure the provider endpoint to call:

```text
https://your-api.example/api/v1/webhooks/stripe
```

The adapter creates Payment Intents and stores only the provider identifier, status metadata and PulseFlow correlation metadata.

## Resend adapter

```env
NOTIFICATION_PROVIDER=resend
RESEND_API_KEY=<api key>
RESEND_FROM=PulseFlow <verified@your-domain.example>
```

Each outbound request uses the notification ID as the idempotency key.

## Rollout sequence

1. Keep the mock/SMTP stack green.
2. Add credentials in the deployment secret manager, never in `.env` committed to Git.
3. Enable one provider in a non-production environment.
4. Verify successful, duplicate, invalid-signature and failed-delivery scenarios.
5. Add alerts before increasing traffic.
