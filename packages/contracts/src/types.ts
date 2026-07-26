export type PaymentState = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'WEBHOOK';
export type FailureMode = 'NONE' | 'FAIL_ONCE' | 'FAIL_ALWAYS' | 'TIMEOUT';
export type UserRole = 'ADMIN' | 'VIEWER';

export interface NotificationJob {
  notificationId: string;
  paymentId: string;
  channel: NotificationChannel;
  recipient: string;
  template: string;
  correlationId: string;
  failureMode?: FailureMode;
}

export interface DeadLetterJob extends NotificationJob {
  failedAt: string;
  error: string;
  attempts: number;
}

export interface RealtimeEvent<T = Record<string, unknown>> {
  id: string;
  type:
    | 'payment.created'
    | 'payment.updated'
    | 'webhook.received'
    | 'notification.queued'
    | 'notification.sent'
    | 'notification.failed'
    | 'queue.retried';
  occurredAt: string;
  correlationId: string;
  payload: T;
}

export interface CreatePaymentInput {
  customerName: string;
  customerEmail: string;
  amount: number;
  currency?: string;
  idempotencyKey?: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
}
