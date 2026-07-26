import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  it('creates a deterministic provider-shaped response without external credentials', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.create({
      paymentId: 'payment-1',
      amount: 12_990,
      currency: 'BRL',
      customerEmail: 'customer@example.com',
      idempotencyKey: 'idem-1',
    });

    expect(provider.name).toBe('mock');
    expect(result.externalId).toMatch(/^mock_pi_[a-f0-9]+$/);
    expect(result.metadata).toEqual({
      environment: 'local-demo',
      requiresExternalAccount: false,
    });
  });

  it('cancels without calling an external service', async () => {
    const provider = new MockPaymentProvider();
    await expect(provider.cancel('mock_pi_1')).resolves.toBeUndefined();
  });
});
