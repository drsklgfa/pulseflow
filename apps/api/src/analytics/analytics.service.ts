import { Injectable } from '@nestjs/common';
import { NotificationStatus, PaymentStatus, TimelineEventType } from '@pulseflow/database';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

interface DayBucket {
  date: string;
  payments: number;
  approved: number;
  declined: number;
  volumeMinorUnits: number;
  notificationsSent: number;
  notificationsFailed: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly infrastructure: InfrastructureService) {}

  async get(days = 7): Promise<Record<string, unknown>> {
    const safeDays = Math.min(30, Math.max(7, days));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - safeDays + 1);
    since.setUTCHours(0, 0, 0, 0);

    const [payments, notifications, events] = await Promise.all([
      this.infrastructure.prisma.payment.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, amount: true, status: true, createdAt: true },
      }),
      this.infrastructure.prisma.notification.findMany({
        where: { createdAt: { gte: since } },
        select: { status: true, channel: true, attempts: true, createdAt: true },
      }),
      this.infrastructure.prisma.processingEvent.findMany({
        where: {
          createdAt: { gte: since },
          type: { in: [TimelineEventType.PAYMENT_CREATED, TimelineEventType.NOTIFICATION_SENT] },
        },
        select: { paymentId: true, type: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const buckets = new Map<string, DayBucket>();
    for (let index = 0; index < safeDays; index += 1) {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, {
        date: key,
        payments: 0,
        approved: 0,
        declined: 0,
        volumeMinorUnits: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
      });
    }

    for (const payment of payments) {
      const bucket = buckets.get(payment.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      bucket.payments += 1;
      bucket.volumeMinorUnits += payment.amount;
      if (payment.status === PaymentStatus.APPROVED) bucket.approved += 1;
      if (payment.status === PaymentStatus.DECLINED) bucket.declined += 1;
    }
    for (const notification of notifications) {
      const bucket = buckets.get(notification.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (notification.status === NotificationStatus.SENT) bucket.notificationsSent += 1;
      if (notification.status === NotificationStatus.FAILED) bucket.notificationsFailed += 1;
    }

    const timelines = new Map<string, { started?: number; finished?: number }>();
    for (const event of events) {
      const current = timelines.get(event.paymentId) ?? {};
      if (event.type === TimelineEventType.PAYMENT_CREATED) current.started ??= event.createdAt.getTime();
      if (event.type === TimelineEventType.NOTIFICATION_SENT) current.finished = event.createdAt.getTime();
      timelines.set(event.paymentId, current);
    }
    const latencies = [...timelines.values()]
      .filter((item): item is { started: number; finished: number } =>
        typeof item.started === 'number' && typeof item.finished === 'number',
      )
      .map((item) => item.finished - item.started)
      .filter((value) => value >= 0);

    const attempts = notifications.reduce((sum, item) => sum + item.attempts, 0);
    const sent = notifications.filter((item) => item.status === NotificationStatus.SENT).length;
    return {
      periodDays: safeDays,
      series: [...buckets.values()],
      totals: {
        payments: payments.length,
        volumeMinorUnits: payments.reduce((sum, item) => sum + item.amount, 0),
        approvalRate:
          payments.length === 0
            ? 0
            : Math.round(
                (payments.filter((item) => item.status === PaymentStatus.APPROVED).length /
                  payments.length) *
                  1000,
              ) / 10,
        deliveryRate:
          notifications.length === 0 ? 0 : Math.round((sent / notifications.length) * 1000) / 10,
        averageAttempts:
          notifications.length === 0
            ? 0
            : Math.round((attempts / notifications.length) * 100) / 100,
        averageProcessingLatencyMs:
          latencies.length === 0
            ? 0
            : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
