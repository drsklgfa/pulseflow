import { randomUUID } from 'node:crypto';
import type {
  PaymentProvider,
  ProviderPaymentInput,
  ProviderPaymentResult,
} from './payment-provider';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async create(_input: ProviderPaymentInput): Promise<ProviderPaymentResult> {
    return {
      externalId: `mock_pi_${randomUUID().replaceAll('-', '')}`,
      metadata: { environment: 'local-demo', requiresExternalAccount: false },
    };
  }

  async cancel(_externalId: string): Promise<void> {
    return Promise.resolve();
  }
}
