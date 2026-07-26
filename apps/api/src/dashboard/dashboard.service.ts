import { Injectable } from '@nestjs/common';
import { NotificationStatus, PaymentStatus } from '@pulseflow/database';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@Injectable()
export class DashboardService {
  constructor(private readonly infrastructure: InfrastructureService) {}

  async getSummary(): Promise<Record<string, unknown>> {
    const prisma = this.infrastructure.prisma;
    const [payments, approved, pending, declined, sent, failed, recentPayments, recentEvents, queueCounts, deadLetterCounts, totalVolume, recentWebhooks] =
      await Promise.all([
        prisma.payment.count(),
        prisma.payment.count({ where: { status: PaymentStatus.APPROVED } }),
        prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
        prisma.payment.count({ where: { status: PaymentStatus.DECLINED } }),
        prisma.notification.count({ where: { status: NotificationStatus.SENT } }),
        prisma.notification.count({ where: { status: NotificationStatus.FAILED } }),
        prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { notifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
        prisma.processingEvent.findMany({
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { payment: { select: { customerName: true } } },
        }),
        this.infrastructure.notificationsQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused',
        ),
        this.infrastructure.deadLetterQueue.getJobCounts('waiting', 'completed', 'failed'),
        prisma.payment.aggregate({ _sum: { amount: true } }),
        prisma.webhookEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 8 }),
      ]);

    return {
      metrics: {
        payments,
        approved,
        pending,
        declined,
        approvalRate: payments === 0 ? 0 : Math.round((approved / payments) * 1000) / 10,
        volumeMinorUnits: totalVolume._sum.amount ?? 0,
        notificationsSent: sent,
        notificationsFailed: failed,
      },
      queues: { ...queueCounts, deadLetter: deadLetterCounts.waiting ?? 0 },
      recentPayments,
      recentEvents,
      recentWebhooks,
      generatedAt: new Date().toISOString(),
    };
  }
}
