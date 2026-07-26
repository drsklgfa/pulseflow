import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthTokenPayload, FailureMode, NotificationJob } from '@pulseflow/contracts';
import { DEFAULT_JOB_OPTIONS, JOB_NAMES } from '@pulseflow/contracts';
import {
  NotificationChannel,
  NotificationStatus,
  PaymentStatus,
  TimelineEventType,
} from '@pulseflow/database';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AuditService } from '../common/audit.service';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly infrastructure: InfrastructureService,
    private readonly audit: AuditService,
  ) {}

  async list(input: {
    status?: string;
    channel?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Record<string, unknown>> {
    const status = Object.values(NotificationStatus).includes(input.status as NotificationStatus)
      ? (input.status as NotificationStatus)
      : undefined;
    const channel = Object.values(NotificationChannel).includes(input.channel as NotificationChannel)
      ? (input.channel as NotificationChannel)
      : undefined;
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const where = { ...(status ? { status } : {}), ...(channel ? { channel } : {}) };
    const [items, total] = await Promise.all([
      this.infrastructure.prisma.notification.findMany({
        where,
        include: {
          payment: {
            select: { id: true, customerName: true, customerEmail: true, amount: true, currency: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.infrastructure.prisma.notification.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async getById(id: string): Promise<unknown> {
    const notification = await this.infrastructure.prisma.notification.findUnique({
      where: { id },
      include: { payment: { include: { timeline: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    return notification;
  }

  async queueForPayment(input: {
    paymentId: string;
    customerEmail: string;
    status: PaymentStatus;
    correlationId: string;
    failureMode?: FailureMode;
  }): Promise<unknown> {
    const template =
      input.status === PaymentStatus.APPROVED ? 'payment-approved' : 'payment-declined';
    const notification = await this.infrastructure.prisma.notification.create({
      data: {
        paymentId: input.paymentId,
        channel: NotificationChannel.EMAIL,
        recipient: input.customerEmail,
        template,
        metadata: { failureMode: input.failureMode ?? 'NONE' },
      },
    });
    const payload: NotificationJob = {
      notificationId: notification.id,
      paymentId: input.paymentId,
      channel: 'EMAIL',
      recipient: input.customerEmail,
      template,
      correlationId: input.correlationId,
      failureMode: input.failureMode ?? 'NONE',
    };
    const job = await this.infrastructure.notificationsQueue.add(
      JOB_NAMES.sendNotification,
      payload,
      { ...DEFAULT_JOB_OPTIONS, jobId: notification.id },
    );
    await this.infrastructure.prisma.$transaction([
      this.infrastructure.prisma.notification.update({
        where: { id: notification.id },
        data: { queueJobId: String(job.id) },
      }),
      this.infrastructure.prisma.processingEvent.create({
        data: {
          paymentId: input.paymentId,
          type: TimelineEventType.JOB_QUEUED,
          title: 'Notification queued',
          description: `BullMQ job ${String(job.id)} is waiting for a worker.`,
          correlationId: input.correlationId,
          metadata: { failureMode: input.failureMode ?? 'NONE' },
        },
      }),
    ]);
    await this.infrastructure.publish({
      type: 'notification.queued',
      correlationId: input.correlationId,
      payload: { notificationId: notification.id, paymentId: input.paymentId },
    });
    return notification;
  }

  async retry(
    id: string,
    actor: AuthTokenPayload,
    request: AuthenticatedRequest,
    reason?: string,
  ): Promise<unknown> {
    const notification = await this.infrastructure.prisma.notification.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.status !== NotificationStatus.FAILED) {
      throw new ConflictException('Only failed notifications can be retried manually.');
    }
    const metadata = (notification.metadata ?? {}) as Record<string, unknown>;
    const failureMode = metadata.failureMode === 'FAIL_ALWAYS' ? 'NONE' : metadata.failureMode;
    const correlationId = request.correlationId;
    const jobId = `${notification.id}:manual:${Date.now()}`;
    const job = await this.infrastructure.notificationsQueue.add(
      JOB_NAMES.sendNotification,
      {
        notificationId: notification.id,
        paymentId: notification.paymentId,
        channel: notification.channel,
        recipient: notification.recipient,
        template: notification.template,
        correlationId,
        failureMode: (failureMode as FailureMode | undefined) ?? 'NONE',
      },
      { ...DEFAULT_JOB_OPTIONS, jobId },
    );
    await this.infrastructure.prisma.$transaction([
      this.infrastructure.prisma.notification.update({
        where: { id },
        data: {
          status: NotificationStatus.PENDING,
          queueJobId: String(job.id),
          lastError: null,
          metadata: { ...metadata, failureMode: failureMode ?? 'NONE', retryReason: reason ?? null },
        },
      }),
      this.infrastructure.prisma.processingEvent.create({
        data: {
          paymentId: notification.paymentId,
          type: TimelineEventType.JOB_RETRIED,
          title: 'Notification retried manually',
          description: reason?.trim() || 'An administrator returned the failed job to the queue.',
          correlationId,
        },
      }),
    ]);
    await Promise.all([
      this.infrastructure.publish({
        type: 'queue.retried',
        correlationId,
        payload: { notificationId: id, jobId: String(job.id) },
      }),
      this.audit.record({
        action: 'notification.retry',
        resource: 'notification',
        resourceId: id,
        actor,
        request,
        metadata: { reason: reason ?? null },
      }),
    ]);
    return this.getById(id);
  }
}
