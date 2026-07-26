import { describe, expect, it } from 'vitest';
import {
  createAccessToken,
  createWebhookSignature,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
  verifyStripeSignature,
  verifyWebhookSignature,
} from './security';

const secret = 'pulseflow-test-secret-with-32-characters';

describe('security contracts', () => {
  it('signs and verifies access tokens', () => {
    const token = createAccessToken(
      { sub: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' },
      secret,
      60,
      100,
    );
    expect(verifyAccessToken(token, secret, 120).sub).toBe('user-1');
    expect(() => verifyAccessToken(token, secret, 161)).toThrow('expired');
  });

  it('hashes passwords with random salts', () => {
    const encoded = hashPassword('PulseFlow123!', 'fixed-salt');
    expect(verifyPassword('PulseFlow123!', encoded)).toBe(true);
    expect(verifyPassword('wrong-password', encoded)).toBe(false);
  });

  it('validates mock webhook signatures', () => {
    const body = JSON.stringify({ event: 'payment.approved' });
    const signature = createWebhookSignature(body, secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(body, 'bad', secret)).toBe(false);
  });

  it('validates Stripe-style timestamped signatures', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = 1_000;
    const signature = createWebhookSignature(`${timestamp}.${body}`, secret);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, 300, 1_100)).toBe(true);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, 10, 1_100)).toBe(false);
  });
});
