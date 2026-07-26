import { describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificationJob } from '@pulseflow/contracts';
import { assertFailureMode } from './processor';

function job(failureMode: NotificationJob['failureMode'], attemptsMade = 0): Job<NotificationJob> {
  return {
    attemptsMade,
    data: {
      notificationId: 'n1',
      paymentId: 'p1',
      channel: 'EMAIL',
      recipient: 'test@example.com',
      template: 'payment-approved',
      correlationId: 'c1',
      failureMode,
    },
  } as Job<NotificationJob>;
}

describe('failure laboratory', () => {
  it('fails once only on the first attempt', () => {
    expect(() => assertFailureMode(job('FAIL_ONCE', 0))).toThrow('transient');
    expect(() => assertFailureMode(job('FAIL_ONCE', 1))).not.toThrow();
  });

  it('keeps permanent failures terminal', () => {
    expect(() => assertFailureMode(job('FAIL_ALWAYS', 3))).toThrow('permanent');
  });
});
