import type { Job } from 'bullmq';
import type { NotificationJob } from '@pulseflow/contracts';
import { NotificationStatus, TimelineEventType } from '@pulseflow/database';
import type { createPrismaClient } from '@pulseflow/database';
import type { NotificationProvider } from './providers/notification-provider';
import { renderNotificationTemplate } from './templates';

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

export function assertFailureMode(job: Job<NotificationJob>): void {
  const mode = job.data.failureMode ?? 'NONE';
  if (mode === 'FAIL_ALWAYS') throw new Error('Simulated permanent provider failure.');
  if (mode === 'FAIL_ONCE' && job.attemptsMade === 0) {
    throw new Error('Simulated transient provider failure on the first attempt.');
  }
  if (mode === 'TIMEOUT') throw new Error('Simulated provider timeout.');
}

export async function processNotification(
  job: Job<NotificationJob>,
  prisma: PrismaClientInstance,
  provider: NotificationProvider,
): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: job.data.notificationId },
    include: { payment: true },
  });
  if (!notification) throw new Error(`Notification ${job.data.notificationId} not found.`);

  await prisma.$transaction([
    prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    }),
    prisma.processingEvent.create({
      data: {
        paymentId: notification.paymentId,
        type: TimelineEventType.JOB_STARTED,
        title: 'Worker started the notification',
        description: `Attempt ${job.attemptsMade + 1} is being processed by ${provider.name}.`,
        correlationId: job.data.correlationId,
      },
    }),
  ]);

  if (job.data.failureMode === 'TIMEOUT') {
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  assertFailureMode(job);

  const rendered = renderNotificationTemplate(notification.template, {
    customerName: notification.payment.customerName,
    amount: notification.payment.amount,
    currency: notification.payment.currency,
    status: notification.payment.status,
    paymentId: notification.paymentId,
  });
  await provider.send({
    channel: notification.channel,
    recipient: notification.recipient,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: notification.id,
    payload: {
      notificationId: notification.id,
      paymentId: notification.paymentId,
      status: notification.payment.status,
    },
  });

  await prisma.$transaction([
    prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.SENT, sentAt: new Date(), lastError: null },
    }),
    prisma.processingEvent.create({
      data: {
        paymentId: notification.paymentId,
        type: TimelineEventType.NOTIFICATION_SENT,
        title: 'Notification sent',
        description: `${notification.channel} was delivered by ${provider.name}.`,
        correlationId: job.data.correlationId,
      },
    }),
  ]);
}
