import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  REALTIME_CHANNEL,
  type DeadLetterJob,
  type NotificationJob,
  type RealtimeEvent,
} from '@pulseflow/contracts';
import { createPrismaClient, NotificationStatus, TimelineEventType } from '@pulseflow/database';
import { processNotification } from './processor';
import { resolveNotificationProvider } from './providers/notification-provider';

const prisma = createPrismaClient();
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const publisher = connection.duplicate();
const deadLetterQueue = new Queue<DeadLetterJob>(QUEUE_NAMES.deadLetter, { connection });
const provider = resolveNotificationProvider();

async function publish(
  event: Omit<RealtimeEvent<Record<string, unknown>>, 'id' | 'occurredAt'>,
): Promise<void> {
  await publisher.publish(
    REALTIME_CHANNEL,
    JSON.stringify({ ...event, id: randomUUID(), occurredAt: new Date().toISOString() }),
  );
}

const worker = new Worker<NotificationJob>(
  QUEUE_NAMES.notifications,
  (job: Job<NotificationJob>) => processNotification(job, prisma, provider),
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    limiter: { max: Number(process.env.WORKER_RATE_MAX ?? 100), duration: 1_000 },
  },
);

worker.on('completed', (job: Job<NotificationJob>) => {
  console.log(JSON.stringify({ level: 'info', event: 'job.completed', jobId: job.id }));
  void publish({
    type: 'notification.sent',
    correlationId: job.data.correlationId,
    payload: { notificationId: job.data.notificationId, paymentId: job.data.paymentId },
  });
});

worker.on('failed', (job: Job<NotificationJob> | undefined, error: Error) => {
  void (async () => {
    console.error(
      JSON.stringify({ level: 'error', event: 'job.failed', jobId: job?.id, error: error.message }),
    );
    if (!job) return;
    const terminal = job.attemptsMade >= (job.opts.attempts ?? 1);
    await prisma.$transaction([
      prisma.notification.update({
        where: { id: job.data.notificationId },
        data: {
          status: terminal ? NotificationStatus.FAILED : NotificationStatus.PENDING,
          lastError: error.message.slice(0, 500),
        },
      }),
      prisma.processingEvent.create({
        data: {
          paymentId: job.data.paymentId,
          type: TimelineEventType.JOB_FAILED,
          title: terminal ? 'Notification moved to dead letter' : 'Notification attempt failed',
          description: error.message.slice(0, 500),
          correlationId: job.data.correlationId,
          metadata: { terminal, attempt: job.attemptsMade },
        },
      }),
    ]);
    if (terminal) {
      await deadLetterQueue.add(
        JOB_NAMES.deadLetterNotification,
        {
          ...job.data,
          failedAt: new Date().toISOString(),
          error: error.message.slice(0, 500),
          attempts: job.attemptsMade,
        },
        { jobId: `dlq:${job.data.notificationId}:${Date.now()}`, removeOnComplete: 500 },
      );
    }
    await publish({
      type: 'notification.failed',
      correlationId: job.data.correlationId,
      payload: {
        notificationId: job.data.notificationId,
        paymentId: job.data.paymentId,
        terminal,
        attemptsMade: job.attemptsMade,
      },
    });
  })().catch((handlerError: unknown) => {
    console.error('Unable to persist a failed job event.', handlerError);
  });
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; closing worker safely.`);
  await Promise.allSettled([
    worker.close(),
    deadLetterQueue.close(),
    publisher.quit(),
    connection.quit(),
    prisma.$disconnect(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
console.log(`PulseFlow notification worker is ready with provider ${provider.name}.`);
