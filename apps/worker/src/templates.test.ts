import { describe, expect, it } from 'vitest';
import { renderNotificationTemplate } from './templates';

describe('notification templates', () => {
  it('renders localized money and escapes customer content', () => {
    const result = renderNotificationTemplate('payment-approved', {
      customerName: '<script>alert(1)</script>',
      amount: 12990,
      currency: 'BRL',
      status: 'APPROVED',
      paymentId: 'pay-1',
    });
    expect(result.subject).toContain('approved');
    expect(result.html).toContain('R$');
    expect(result.html).not.toContain('<script>');
    expect(result.text).toContain('pay-1');
  });
});
