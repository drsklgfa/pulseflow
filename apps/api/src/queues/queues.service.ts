import { Injectable } from '@nestjs/common';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@Injectable()
export class QueuesService {
  constructor(private readonly infrastructure: InfrastructureService) {}

  async overview(): Promise<Record<string, unknown>> {
    const [notifications, deadLetter] = await Promise.all([
      this.infrastructure.notificationsQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      ),
      this.infrastructure.deadLetterQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
    ]);
    return {
      notifications,
      deadLetter,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
      retryPolicy: { attempts: 4, strategy: 'exponential', initialDelayMs: 1_500 },
      generatedAt: new Date().toISOString(),
    };
  }

  async failed(): Promise<unknown[]> {
    const jobs = await this.infrastructure.notificationsQueue.getJobs(['failed'], 0, 49, false);
    return Promise.all(
      jobs.map(async (job) => ({
        id: String(job.id),
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        notification: await this.infrastructure.prisma.notification.findUnique({
          where: { id: job.data.notificationId },
          include: { payment: { select: { customerName: true, amount: true, currency: true } } },
        }),
      })),
    );
  }

  async pause(): Promise<Record<string, unknown>> {
    await this.infrastructure.notificationsQueue.pause();
    return { status: 'paused', at: new Date().toISOString() };
  }

  async resume(): Promise<Record<string, unknown>> {
    await this.infrastructure.notificationsQueue.resume();
    return { status: 'running', at: new Date().toISOString() };
  }

  async clean(): Promise<Record<string, unknown>> {
    const [completed, failed] = await Promise.all([
      this.infrastructure.notificationsQueue.clean(60 * 60 * 1000, 500, 'completed'),
      this.infrastructure.notificationsQueue.clean(7 * 24 * 60 * 60 * 1000, 500, 'failed'),
    ]);
    return { removed: { completed: completed.length, failed: failed.length } };
  }
}
