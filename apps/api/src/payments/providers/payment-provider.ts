export interface ProviderPaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  idempotencyKey: string;
}

export interface ProviderPaymentResult {
  externalId: string;
  clientSecret?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PaymentProvider {
  readonly name: string;
  create(input: ProviderPaymentInput): Promise<ProviderPaymentResult>;
  cancel(externalId: string): Promise<void>;
}
