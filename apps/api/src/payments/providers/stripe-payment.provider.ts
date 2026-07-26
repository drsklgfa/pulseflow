import type {
  PaymentProvider,
  ProviderPaymentInput,
  ProviderPaymentResult,
} from './payment-provider';

interface StripePaymentIntent {
  id: string;
  client_secret?: string;
  status?: string;
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  private get apiKey(): string {
    const value = process.env.STRIPE_SECRET_KEY;
    if (!value) throw new Error('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe.');
    return value;
  }

  async create(input: ProviderPaymentInput): Promise<ProviderPaymentResult> {
    const body = new URLSearchParams({
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      'automatic_payment_methods[enabled]': 'true',
      receipt_email: input.customerEmail,
      'metadata[pulseflow_payment_id]': input.paymentId,
    });
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': input.idempotencyKey,
      },
      body,
    });
    const payload = (await response.json()) as StripePaymentIntent & {
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message ?? 'Stripe rejected the payment.');
    return {
      externalId: payload.id,
      clientSecret: payload.client_secret,
      metadata: { stripeStatus: payload.status ?? 'requires_payment_method' },
    };
  }

  async cancel(externalId: string): Promise<void> {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${externalId}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error('Stripe could not cancel the payment intent.');
  }
}
