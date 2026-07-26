import type {
  AnalyticsData,
  AuditEntry,
  AuthSession,
  DashboardData,
  FailureMode,
  Notification,
  Payment,
  QueueOverview,
  RealtimeEvent,
  WebhookEvent,
  WorkspaceData,
} from './types';

const STORE_KEY = 'pulseflow-portfolio-v1';
const EVENT_NAME = 'pulseflow:demo-event';
const now = () => new Date().toISOString();
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;

interface DemoState {
  payments: Payment[];
  notifications: Notification[];
  webhooks: WebhookEvent[];
  audit: AuditEntry[];
  queue: Record<string, number>;
}

function timeline(paymentId: string, status: Payment['status'], createdAt: string): Payment['timeline'] {
  const correlationId = id('corr');
  const events = [
    {
      id: id('evt'),
      type: 'PAYMENT_CREATED',
      title: 'Payment created',
      description: 'The API validated and persisted the orchestration request.',
      correlationId,
      createdAt,
    },
  ];
  if (status !== 'PENDING') {
    events.push(
      {
        id: id('evt'),
        type: 'WEBHOOK_RECEIVED',
        title: 'Webhook accepted',
        description: 'The signature and replay protection checks passed.',
        correlationId,
        createdAt: new Date(new Date(createdAt).getTime() + 1_200).toISOString(),
      },
      {
        id: id('evt'),
        type: 'PAYMENT_UPDATED',
        title: `Payment ${status.toLowerCase()}`,
        description: 'The event advanced the payment state exactly once.',
        correlationId,
        createdAt: new Date(new Date(createdAt).getTime() + 2_000).toISOString(),
      },
      {
        id: id('evt'),
        type: status === 'APPROVED' ? 'NOTIFICATION_SENT' : 'JOB_FAILED',
        title: status === 'APPROVED' ? 'Notification sent' : 'Notification moved to dead letter',
        description:
          status === 'APPROVED'
            ? 'The asynchronous worker delivered the e-mail.'
            : 'The provider exhausted all retry attempts.',
        correlationId,
        createdAt: new Date(new Date(createdAt).getTime() + 5_000).toISOString(),
      },
    );
  }
  return events;
}

function initialState(): DemoState {
  const entries: Array<[string, string, number, Payment['status'], number]> = [
    ['Marina Costa', 'marina@example.com', 12990, 'APPROVED', 1],
    ['Rafael Lima', 'rafael@example.com', 7990, 'PENDING', 2],
    ['Camila Rocha', 'camila@example.com', 24900, 'DECLINED', 4],
    ['Lucas Vieira', 'lucas@example.com', 18950, 'APPROVED', 7],
    ['Aline Martins', 'aline@example.com', 4590, 'APPROVED', 11],
    ['Thiago Nunes', 'thiago@example.com', 31500, 'APPROVED', 18],
    ['Beatriz Souza', 'beatriz@example.com', 9990, 'DECLINED', 27],
    ['Daniel Ribeiro', 'daniel@example.com', 14990, 'APPROVED', 35],
    ['Sofia Almeida', 'sofia@example.com', 5990, 'APPROVED', 50],
    ['Henrique Melo', 'henrique@example.com', 21800, 'APPROVED', 68],
  ];
  const payments = entries.map(([customerName, customerEmail, amount, status, hours], index) => {
    const paymentId = `demo_payment_${index + 1}`;
    const createdAt = ago(hours);
    return {
      id: paymentId,
      externalId: `mock_pi_${index + 1}`,
      customerName,
      customerEmail,
      amount,
      currency: 'BRL',
      status,
      provider: 'mock',
      createdAt,
      timeline: timeline(paymentId, status, createdAt),
    } satisfies Payment;
  });
  const notifications: Notification[] = payments
    .filter((payment) => payment.status !== 'PENDING')
    .map((payment, index) => ({
      id: `demo_notification_${index + 1}`,
      paymentId: payment.id,
      channel: 'EMAIL',
      status: payment.status === 'APPROVED' ? 'SENT' : 'FAILED',
      recipient: payment.customerEmail,
      template: payment.status === 'APPROVED' ? 'payment-approved' : 'payment-declined',
      attempts: payment.status === 'APPROVED' ? 1 : 4,
      maxAttempts: 4,
      queueJobId: `demo_job_${index + 1}`,
      lastError: payment.status === 'DECLINED' ? 'Demo provider rejected the final attempt.' : null,
      sentAt: payment.status === 'APPROVED' ? payment.timeline?.at(-1)?.createdAt : null,
      createdAt: payment.timeline?.at(-1)?.createdAt ?? payment.createdAt,
      payment,
    }));
  const webhooks: WebhookEvent[] = payments
    .filter((payment) => payment.status !== 'PENDING')
    .map((payment, index) => ({
      id: `demo_webhook_${index + 1}`,
      externalEventId: `mock_evt_${index + 1}`,
      provider: 'mock',
      eventType: `payment.${payment.status.toLowerCase()}`,
      signatureValid: true,
      processedAt: payment.timeline?.[1]?.createdAt,
      receivedAt: payment.timeline?.[1]?.createdAt ?? payment.createdAt,
      paymentId: payment.id,
    }));
  return {
    payments,
    notifications,
    webhooks,
    audit: [
      { id: 'audit_1', action: 'portfolio.seed', resource: 'workspace', createdAt: ago(72), actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' } },
      { id: 'audit_2', action: 'payment.create', resource: 'payment', resourceId: payments[0]?.id, createdAt: ago(1), actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' } },
    ],
    queue: { waiting: 3, active: 1, completed: 126, failed: 2, delayed: 1, paused: 0, deadLetter: 2 },
  };
}

function load(): DemoState {
  const stored = localStorage.getItem(STORE_KEY);
  if (!stored) {
    const state = initialState();
    save(state);
    return state;
  }
  try {
    return JSON.parse(stored) as DemoState;
  } catch {
    const state = initialState();
    save(state);
    return state;
  }
}

function save(state: DemoState): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function emit(type: string, payload: Record<string, unknown>): void {
  const event: RealtimeEvent = {
    id: id('realtime'),
    type,
    occurredAt: now(),
    correlationId: id('corr'),
    payload,
  };
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
}

function analytics(state: DemoState): AnalyticsData {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const series = dates.map((date) => {
    const payments = state.payments.filter((payment) => payment.createdAt.slice(0, 10) === date);
    const notifications = state.notifications.filter((item) => item.createdAt.slice(0, 10) === date);
    return {
      date,
      payments: payments.length,
      approved: payments.filter((item) => item.status === 'APPROVED').length,
      declined: payments.filter((item) => item.status === 'DECLINED').length,
      volumeMinorUnits: payments.reduce((sum, item) => sum + item.amount, 0),
      notificationsSent: notifications.filter((item) => item.status === 'SENT').length,
      notificationsFailed: notifications.filter((item) => item.status === 'FAILED').length,
    };
  });
  const sent = state.notifications.filter((item) => item.status === 'SENT').length;
  const approved = state.payments.filter((item) => item.status === 'APPROVED').length;
  return {
    periodDays: 7,
    series,
    totals: {
      payments: state.payments.length,
      volumeMinorUnits: state.payments.reduce((sum, item) => sum + item.amount, 0),
      approvalRate: Math.round((approved / state.payments.length) * 1000) / 10,
      deliveryRate: state.notifications.length ? Math.round((sent / state.notifications.length) * 1000) / 10 : 0,
      averageAttempts: state.notifications.length ? Math.round((state.notifications.reduce((sum, item) => sum + item.attempts, 0) / state.notifications.length) * 100) / 100 : 0,
      averageProcessingLatencyMs: 3450,
    },
    generatedAt: now(),
  };
}

function dashboard(state: DemoState): DashboardData {
  const approved = state.payments.filter((item) => item.status === 'APPROVED').length;
  const pending = state.payments.filter((item) => item.status === 'PENDING').length;
  const declined = state.payments.filter((item) => item.status === 'DECLINED').length;
  const recentEvents = state.payments
    .flatMap((payment) => (payment.timeline ?? []).map((event) => ({ ...event, payment: { customerName: payment.customerName } })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  return {
    metrics: {
      payments: state.payments.length,
      approved,
      pending,
      declined,
      approvalRate: state.payments.length ? Math.round((approved / state.payments.length) * 1000) / 10 : 0,
      volumeMinorUnits: state.payments.reduce((sum, item) => sum + item.amount, 0),
      notificationsSent: state.notifications.filter((item) => item.status === 'SENT').length,
      notificationsFailed: state.notifications.filter((item) => item.status === 'FAILED').length,
    },
    queues: state.queue,
    recentPayments: state.payments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    recentEvents,
    recentWebhooks: state.webhooks.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 8),
    generatedAt: now(),
  };
}

export function demoLogin(email: string, password: string): AuthSession {
  if (email.toLowerCase() !== 'admin@pulseflow.local' || password !== 'PulseFlow123!') {
    throw new Error('Use the demo credentials displayed below the form.');
  }
  return {
    accessToken: 'demo-access-token',
    expiresIn: 28_800,
    demo: true,
    user: { id: 'demo-admin', name: 'PulseFlow Admin', email, role: 'ADMIN' },
  };
}

export function demoWorkspace(): WorkspaceData {
  const state = load();
  const queues: QueueOverview = {
    notifications: state.queue,
    deadLetter: { waiting: state.queue.deadLetter ?? 0, active: 0, completed: 0, failed: 0, delayed: 0 },
    concurrency: 5,
    retryPolicy: { attempts: 4, strategy: 'exponential', initialDelayMs: 1500 },
    generatedAt: now(),
  };
  return {
    dashboard: dashboard(state),
    payments: state.payments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notifications: state.notifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    webhooks: state.webhooks.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    analytics: analytics(state),
    queues,
    audit: state.audit.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function demoPayment(idValue: string): Payment | undefined {
  return load().payments.find((payment) => payment.id === idValue);
}

export function demoCreatePayment(input: { customerName: string; customerEmail: string; amount: number }): Payment {
  const state = load();
  const paymentId = id('payment');
  const createdAt = now();
  const payment: Payment = {
    id: paymentId,
    externalId: id('mock_pi'),
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.toLowerCase(),
    amount: Math.round(input.amount * 100),
    currency: 'BRL',
    status: 'PENDING',
    provider: 'mock',
    createdAt,
    timeline: timeline(paymentId, 'PENDING', createdAt),
  };
  state.payments.unshift(payment);
  state.queue.waiting = (state.queue.waiting ?? 0) + 1;
  state.audit.unshift({ id: id('audit'), action: 'payment.create', resource: 'payment', resourceId: payment.id, createdAt, actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' } });
  save(state);
  emit('payment.created', { paymentId: payment.id, amount: payment.amount, status: payment.status });
  return payment;
}

export function demoSimulate(paymentId: string, status: 'APPROVED' | 'DECLINED', failureMode: FailureMode): void {
  const state = load();
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error('Payment not found.');
  if (payment.status !== 'PENDING') throw new Error('Choose a pending payment.');
  const correlationId = id('corr');
  const eventAt = now();
  payment.status = status;
  payment.updatedAt = eventAt;
  payment.timeline = [
    ...(payment.timeline ?? []),
    { id: id('evt'), type: 'WEBHOOK_RECEIVED', title: 'Webhook accepted', description: 'Signature and replay checks passed.', correlationId, createdAt: eventAt },
    { id: id('evt'), type: 'PAYMENT_UPDATED', title: `Payment ${status.toLowerCase()}`, description: 'The state transition was applied idempotently.', correlationId, createdAt: eventAt },
  ];
  const webhook: WebhookEvent = {
    id: id('webhook'),
    externalEventId: id('mock_evt'),
    provider: 'mock',
    eventType: `payment.${status.toLowerCase()}`,
    signatureValid: true,
    processedAt: eventAt,
    receivedAt: eventAt,
    paymentId,
  };
  state.webhooks.unshift(webhook);
  const terminalFailure = failureMode === 'FAIL_ALWAYS' || failureMode === 'TIMEOUT';
  const notification: Notification = {
    id: id('notification'),
    paymentId,
    channel: 'EMAIL',
    status: terminalFailure ? 'FAILED' : 'SENT',
    recipient: payment.customerEmail,
    template: status === 'APPROVED' ? 'payment-approved' : 'payment-declined',
    attempts: failureMode === 'FAIL_ONCE' ? 2 : terminalFailure ? 4 : 1,
    maxAttempts: 4,
    queueJobId: id('job'),
    lastError: terminalFailure ? (failureMode === 'TIMEOUT' ? 'Provider timeout after four attempts.' : 'Permanent provider failure.') : null,
    sentAt: terminalFailure ? null : now(),
    createdAt: eventAt,
    payment,
  };
  state.notifications.unshift(notification);
  payment.timeline!.push({
    id: id('evt'),
    type: terminalFailure ? 'JOB_FAILED' : 'NOTIFICATION_SENT',
    title: terminalFailure ? 'Notification moved to dead letter' : 'Notification sent',
    description: terminalFailure ? notification.lastError ?? 'All attempts failed.' : `Delivered after ${notification.attempts} attempt(s).`,
    correlationId,
    createdAt: now(),
  });
  state.queue.waiting = Math.max(0, (state.queue.waiting ?? 0) - 1);
  state.queue.completed = (state.queue.completed ?? 0) + (terminalFailure ? 0 : 1);
  state.queue.failed = (state.queue.failed ?? 0) + (terminalFailure ? 1 : 0);
  state.queue.deadLetter = (state.queue.deadLetter ?? 0) + (terminalFailure ? 1 : 0);
  state.audit.unshift({ id: id('audit'), action: 'lab.simulate', resource: 'payment', resourceId: paymentId, createdAt: now(), actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' }, metadata: { status, failureMode } });
  save(state);
  emit('payment.updated', { paymentId, status });
  emit(terminalFailure ? 'notification.failed' : 'notification.sent', { paymentId, notificationId: notification.id, attempts: notification.attempts });
}

export function demoInvalidSignature(paymentId: string): void {
  const state = load();
  state.webhooks.unshift({
    id: id('webhook'),
    externalEventId: id('mock_evt_invalid'),
    provider: 'mock',
    eventType: 'payment.approved',
    signatureValid: false,
    processingError: 'Signature validation failed.',
    receivedAt: now(),
    paymentId,
  });
  state.audit.unshift({ id: id('audit'), action: 'webhook.reject', resource: 'payment', resourceId: paymentId, createdAt: now(), actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' } });
  save(state);
  emit('webhook.rejected', { paymentId });
}

export function demoRetry(notificationId: string): void {
  const state = load();
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (!notification || notification.status !== 'FAILED') throw new Error('Failed notification not found.');
  notification.status = 'SENT';
  notification.attempts += 1;
  notification.lastError = null;
  notification.sentAt = now();
  state.queue.failed = Math.max(0, (state.queue.failed ?? 0) - 1);
  state.queue.deadLetter = Math.max(0, (state.queue.deadLetter ?? 0) - 1);
  state.queue.completed = (state.queue.completed ?? 0) + 1;
  state.audit.unshift({ id: id('audit'), action: 'notification.retry', resource: 'notification', resourceId: notificationId, createdAt: now(), actor: { name: 'PulseFlow Admin', email: 'admin@pulseflow.local', role: 'ADMIN' } });
  save(state);
  emit('queue.retried', { notificationId });
}

export function resetDemo(): void {
  save(initialState());
  emit('workspace.reset', {});
}

export function subscribeDemo(listener: (event: RealtimeEvent) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<RealtimeEvent>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
