import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createPrismaClient } from '@pulseflow/database';
import {
  QUEUE_NAMES,
  REALTIME_CHANNEL,
  type RealtimeEvent,
} from '@pulseflow/contracts';

@Injectable()
export class InfrastructureService implements OnModuleDestroy {
  readonly prisma = createPrismaClient();
  readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  readonly publisher = this.redis.duplicate();
  readonly subscriber = this.redis.duplicate();
  readonly notificationsQueue = new Queue(QUEUE_NAMES.notifications, {
    connection: this.redis,
  });
  readonly deadLetterQueue = new Queue(QUEUE_NAMES.deadLetter, {
    connection: this.redis,
  });

  async publish<T extends Record<string, unknown>>(
    event: Omit<RealtimeEvent<T>, 'id' | 'occurredAt'>,
  ): Promise<void> {
    const payload: RealtimeEvent<T> = {
      ...event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    await this.publisher.publish(REALTIME_CHANNEL, JSON.stringify(payload));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.notificationsQueue.close(),
      this.deadLetterQueue.close(),
      this.publisher.quit(),
      this.subscriber.quit(),
      this.redis.quit(),
      this.prisma.$disconnect(),
    ]);
  }
}
