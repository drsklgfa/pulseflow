import { createHash } from 'node:crypto';
import type { PaymentState } from './types';

const transitions: Record<PaymentState, readonly PaymentState[]> = {
  PENDING: ['APPROVED', 'DECLINED', 'CANCELLED'],
  APPROVED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function canTransitionPayment(from: PaymentState, to: PaymentState): boolean {
  return transitions[from].includes(to);
}

export function normalizeCurrency(currency = 'BRL'): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency must use the ISO 4217 three-letter format.');
  }
  return normalized;
}

export function amountToMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

export function buildIdempotencyKey(parts: readonly string[]): string {
  const value = parts.map((part) => part.trim().toLowerCase()).join('|');
  return createHash('sha256').update(value).digest('hex');
}

export function calculateExponentialBackoff(attempt: number, baseDelayMs = 1_500): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error('Attempt must be a positive integer.');
  }
  return baseDelayMs * 2 ** (attempt - 1);
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
