import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { hashPassword } from '@pulseflow/contracts';
import {
  createPrismaClient,
  NotificationChannel,
  NotificationStatus,
  PaymentStatus,
  TimelineEventType,
  UserRole,
} from './index';

const prisma = createPrismaClient();

function key(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 60 * 60 * 1000);

async function seedUsers(): Promise<void> {
  const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@pulseflow.local').toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'PulseFlow123!';
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'PulseFlow Admin',
      passwordHash: hashPassword(adminPassword),
      role: UserRole.ADMIN,
    },
    update: {
      name: 'PulseFlow Admin',
      passwordHash: hashPassword(adminPassword),
      role: UserRole.ADMIN,
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@pulseflow.local' },
    create: {
      email: 'viewer@pulseflow.local',
      name: 'Portfolio Viewer',
      passwordHash: hashPassword('PulseFlowViewer123!'),
      role: UserRole.VIEWER,
    },
    update: {},
  });
}

async function seedPayments(): Promise<void> {
  const entries = [
    { name: 'Marina Costa', email: 'marina@example.com', amount: 12990, status: PaymentStatus.APPROVED, hours: 1 },
    { name: 'Rafael Lima', email: 'rafael@example.com', amount: 7990, status: PaymentStatus.PENDING, hours: 2 },
    { name: 'Camila Rocha', email: 'camila@example.com', amount: 24900, status: PaymentStatus.DECLINED, hours: 4 },
    { name: 'Lucas Vieira', email: 'lucas@example.com', amount: 18950, status: PaymentStatus.APPROVED, hours: 7 },
    { name: 'Aline Martins', email: 'aline@example.com', amount: 4590, status: PaymentStatus.APPROVED, hours: 11 },
    { name: 'Thiago Nunes', email: 'thiago@example.com', amount: 31500, status: PaymentStatus.APPROVED, hours: 18 },
    { name: 'Beatriz Souza', email: 'beatriz@example.com', amount: 9990, status: PaymentStatus.DECLINED, hours: 27 },
    { name: 'Daniel Ribeiro', email: 'daniel@example.com', amount: 14990, status: PaymentStatus.APPROVED, hours: 35 },
    { name: 'Sofia Almeida', email: 'sofia@example.com', amount: 5990, status: PaymentStatus.APPROVED, hours: 50 },
    { name: 'Henrique Melo', email: 'henrique@example.com', amount: 21800, status: PaymentStatus.APPROVED, hours: 68 },
  ];

  for (const entry of entries) {
    const idempotencyKey = key(`seed:${entry.email}:${entry.amount}`);
    const createdAt = hoursAgo(entry.hours);
    const payment = await prisma.payment.upsert({
      where: { idempotencyKey },
      create: {
        externalId: `mock_pi_${key(entry.email).slice(0, 16)}`,
        idempotencyKey,
        customerName: entry.name,
        customerEmail: entry.email,
        amount: entry.amount,
        currency: 'BRL',
        status: entry.status,
        provider: 'mock',
        createdAt,
      },
      update: {},
    });

    const timelineCount = await prisma.processingEvent.count({ where: { paymentId: payment.id } });
    if (timelineCount === 0) {
      const correlationId = randomUUID();
      await prisma.processingEvent.create({
        data: {
          paymentId: payment.id,
          type: TimelineEventType.PAYMENT_CREATED,
          title: 'Payment created',
          description: 'Demo payment persisted by the idempotent seed.',
          correlationId,
          createdAt,
        },
      });

      if (entry.status !== PaymentStatus.PENDING) {
        await prisma.webhookEvent.create({
          data: {
            externalEventId: `mock_evt_${key(`${entry.email}:${entry.status}`).slice(0, 18)}`,
            provider: 'mock',
            eventType: `payment.${entry.status.toLowerCase()}`,
            signatureValid: true,
            payload: { paymentId: payment.id, status: entry.status, seed: true },
            processedAt: new Date(createdAt.getTime() + 2_000),
            receivedAt: new Date(createdAt.getTime() + 1_000),
            paymentId: payment.id,
          },
        });
        await prisma.processingEvent.createMany({
          data: [
            {
              paymentId: payment.id,
              type: TimelineEventType.WEBHOOK_RECEIVED,
              title: 'Webhook accepted',
              description: 'A signed mock event was verified and processed.',
              correlationId,
              createdAt: new Date(createdAt.getTime() + 1_000),
            },
            {
              paymentId: payment.id,
              type: TimelineEventType.PAYMENT_UPDATED,
              title: `Payment ${entry.status.toLowerCase()}`,
              description: 'The payment reached a terminal state.',
              correlationId,
              createdAt: new Date(createdAt.getTime() + 2_000),
            },
          ],
        });

        const sent = entry.status === PaymentStatus.APPROVED;
        await prisma.notification.create({
          data: {
            paymentId: payment.id,
            channel: NotificationChannel.EMAIL,
            status: sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
            recipient: entry.email,
            template: sent ? 'payment-approved' : 'payment-declined',
            attempts: sent ? 1 : 4,
            maxAttempts: 4,
            queueJobId: `seed-job-${payment.id}`,
            lastError: sent ? null : 'Demo provider rejected the final attempt.',
            sentAt: sent ? new Date(createdAt.getTime() + 5_000) : null,
            createdAt: new Date(createdAt.getTime() + 3_000),
          },
        });
        await prisma.processingEvent.create({
          data: {
            paymentId: payment.id,
            type: sent ? TimelineEventType.NOTIFICATION_SENT : TimelineEventType.JOB_FAILED,
            title: sent ? 'Notification sent' : 'Notification moved to dead letter',
            description: sent
              ? 'The asynchronous worker delivered the message.'
              : 'All retry attempts were exhausted.',
            correlationId,
            createdAt: new Date(createdAt.getTime() + 5_000),
          },
        });
      }
    }
  }
}

async function seed(): Promise<void> {
  await seedUsers();
  await seedPayments();
  console.log('PulseFlow portfolio data is ready.');
}

seed()
  .catch((error: unknown) => {
    console.error('Unable to seed PulseFlow.', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
