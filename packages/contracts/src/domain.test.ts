import { describe, expect, it } from 'vitest';
import {
  amountToMinorUnits,
  buildIdempotencyKey,
  calculateExponentialBackoff,
  canTransitionPayment,
  maskEmail,
  normalizeCurrency,
} from './domain';

describe('domain contracts', () => {
  it('converts decimal amounts to minor units safely', () => {
    expect(amountToMinorUnits(149.9)).toBe(14990);
    expect(() => amountToMinorUnits(0)).toThrow('positive');
  });

  it('normalizes ISO currencies', () => {
    expect(normalizeCurrency(' brl ')).toBe('BRL');
    expect(() => normalizeCurrency('real')).toThrow('ISO 4217');
  });

  it('enforces terminal payment states', () => {
    expect(canTransitionPayment('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionPayment('APPROVED', 'DECLINED')).toBe(false);
  });

  it('creates deterministic keys and backoff values', () => {
    expect(buildIdempotencyKey(['A', 'B'])).toBe(buildIdempotencyKey([' a ', 'b']));
    expect(calculateExponentialBackoff(4)).toBe(12_000);
  });

  it('masks customer emails in logs', () => {
    expect(maskEmail('gabriel@example.com')).toBe('ga*****@example.com');
  });
});
