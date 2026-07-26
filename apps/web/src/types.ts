export type PaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
export type FailureMode = 'NONE' | 'FAIL_ONCE' | 'FAIL_ALWAYS' | 'TIMEOUT';
export type View =
  | 'overview'
  | 'payments'
  | 'webhooks'
  | 'queues'
  | 'notifications'
  | 'analytics'
  | 'lab'
  | 'audit'
  | 'docs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: User;
  demo: boolean;
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  correlationId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  paymentId: string;
  channel: 'EMAIL' | 'SMS' | 'WEBHOOK';
  status: NotificationStatus;
  recipient: string;
  template: string;
  attempts: number;
  maxAttempts: number;
  queueJobId?: string | null;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
  payment?: Pick<Payment, 'id' | 'customerName' | 'customerEmail' | 'amount' | 'currency'>;
}

export interface WebhookEvent {
  id: string;
  externalEventId: string;
  provider: string;
  eventType: string;
  signatureValid: boolean;
  processingError?: string | null;
  processedAt?: string | null;
  receivedAt: string;
  paymentId?: string | null;
}

export interface Payment {
  id: string;
  externalId?: string | null;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  updatedAt?: string;
  notifications?: Notification[];
  webhookEvents?: WebhookEvent[];
  timeline?: TimelineEvent[];
}

export interface RealtimeEvent {
  id: string;
  type: string;
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

export interface DashboardData {
  metrics: {
    payments: number;
    approved: number;
    pending: number;
    declined: number;
    approvalRate: number;
    volumeMinorUnits: number;
    notificationsSent: number;
    notificationsFailed: number;
  };
  queues: Record<string, number>;
  recentPayments: Payment[];
  recentEvents: Array<TimelineEvent & { payment?: { customerName: string } }>;
  recentWebhooks: WebhookEvent[];
  generatedAt: string;
}

export interface AnalyticsPoint {
  date: string;
  payments: number;
  approved: number;
  declined: number;
  volumeMinorUnits: number;
  notificationsSent: number;
  notificationsFailed: number;
}

export interface AnalyticsData {
  periodDays: number;
  series: AnalyticsPoint[];
  totals: {
    payments: number;
    volumeMinorUnits: number;
    approvalRate: number;
    deliveryRate: number;
    averageAttempts: number;
    averageProcessingLatencyMs: number;
  };
  generatedAt: string;
}

export interface QueueOverview {
  notifications: Record<string, number>;
  deadLetter: Record<string, number>;
  concurrency: number;
  retryPolicy: { attempts: number; strategy: string; initialDelayMs: number };
  generatedAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  createdAt: string;
  actor?: { name: string; email: string; role: string } | null;
  metadata?: Record<string, unknown> | null;
}

export interface WorkspaceData {
  dashboard: DashboardData;
  payments: Payment[];
  notifications: Notification[];
  webhooks: WebhookEvent[];
  analytics: AnalyticsData;
  queues: QueueOverview;
  audit: AuditEntry[];
}
