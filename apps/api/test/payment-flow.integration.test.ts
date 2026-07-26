import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPulseFlowApp } from '../src/app.factory';

const integration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

integration('PulseFlow API integration', () => {
  let app: INestApplication;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    process.env.APP_MODE = 'test';
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.NOTIFICATION_PROVIDER = 'mock';
    process.env.WEBHOOK_SECRET = 'integration-webhook-secret';
    process.env.AUTH_SECRET = 'integration-auth-secret-at-least-32-characters';
    app = await createPulseFlowApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@pulseflow.local',
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'PulseFlow123!',
      }),
    });
    expect(login.status).toBe(201);
    const body = (await login.json()) as { accessToken: string };
    token = body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports PostgreSQL and Redis readiness', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      dependencies: { postgres: 'up', redis: 'up' },
    });
  });

  it('creates an idempotent payment and queues a signed event', async () => {
    const key = `integration-${Date.now()}`;
    const create = () =>
      fetch(`${baseUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify({
          customerName: 'Integration Customer',
          customerEmail: 'integration@example.com',
          amount: 129.9,
          currency: 'BRL',
        }),
      });

    const first = await create();
    expect(first.status).toBe(201);
    const payment = (await first.json()) as { id: string; status: string };
    expect(payment.status).toBe('PENDING');

    const replay = await create();
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toMatchObject({
      id: payment.id,
      idempotentReplay: true,
    });

    const event = await fetch(`${baseUrl}/api/v1/lab/payments/${payment.id}/event`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED', failureMode: 'NONE' }),
    });
    expect(event.status).toBe(201);
    await expect(event.json()).resolves.toMatchObject({
      status: 'processed',
      paymentId: payment.id,
    });

    const details = await fetch(`${baseUrl}/api/v1/payments/${payment.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(details.status).toBe(200);
    const hydrated = (await details.json()) as {
      status: string;
      webhookEvents: unknown[];
      notifications: unknown[];
      timeline: unknown[];
    };
    expect(hydrated.status).toBe('APPROVED');
    expect(hydrated.webhookEvents).toHaveLength(1);
    expect(hydrated.notifications).toHaveLength(1);
    expect(hydrated.timeline.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects protected routes without a token', async () => {
    const response = await fetch(`${baseUrl}/api/v1/payments`);
    expect(response.status).toBe(401);
  });
});
