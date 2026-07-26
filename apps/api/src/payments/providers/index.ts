import type { PaymentProvider } from './payment-provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';

export function resolvePaymentProvider(): PaymentProvider {
  return (process.env.PAYMENT_PROVIDER ?? 'mock').toLowerCase() === 'stripe'
    ? new StripePaymentProvider()
    : new MockPaymentProvider();
}

export * from './payment-provider';
