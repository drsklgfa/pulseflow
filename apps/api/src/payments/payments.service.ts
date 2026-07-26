import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import {
  amountToMinorUnits,
  buildIdempotencyKey,
  normalizeCurrency,
} from '@pulseflow/contracts';
import { PaymentStatus, TimelineEventType } from '@pulseflow/database';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AuditService } from '../common/audit.service';
import { InfrastructureService } from '../infrastructure/infrastructure.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { resolvePaymentProvider } from './providers';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly infrastructure: InfrastructureService,
    private readonly audit: AuditService,
  ) {}

  async list(input: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Record<string, unknown>> {
    const status = Object.values(PaymentStatus).includes(input.status as PaymentStatus)
      ? (input.status as PaymentStatus)
      : undefined;
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const search = input.search?.trim();
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { customerEmail: { contains: search, mode: 'insensitive' as const } },
              { externalId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.infrastructure.prisma.payment.findMany({
        where,
        include: { notifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.infrastructure.prisma.payment.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async getById(id: string): Promise<unknown> {
    const payment = await this.infrastructure.prisma.payment.findUnique({
      where: { id },
      include: {
        notifications: { orderBy: { createdAt: 'desc' } },
        webhookEvents: { orderBy: { receivedAt: 'desc' } },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async create(
    input: CreatePaymentDto,
    headerKey: string | undefined,
    actor: AuthTokenPayload,
    request: AuthenticatedRequest,
  ): Promise<unknown> {
    const amount = amountToMinorUnits(input.amount);
    const currency = normalizeCurrency(input.currency);
    const sourceKey = headerKey?.trim() || input.idempotencyKey?.trim() || randomUUID();
    const idempotencyKey = buildIdempotencyKey([sourceKey]);
    const existing = await this.infrastructure.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return { ...existing, idempotentReplay: true };

    const id = randomUUID();
    const correlationId = request.correlationId;
    const provider = resolvePaymentProvider();
    const providerResult = await provider.create({
      paymentId: id,
      amount,
      currency,
      customerEmail: input.customerEmail.toLowerCase(),
      idempotencyKey,
    });

    const payment = await this.infrastructure.prisma.payment.create({
      data: {
        id,
        externalId: providerResult.externalId,
        idempotencyKey,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.toLowerCase(),
        amount,
        currency,
        status: PaymentStatus.PENDING,
        provider: provider.name,
        metadata: providerResult.metadata,
        timeline: {
          create: {
            type: TimelineEventType.PAYMENT_CREATED,
            title: 'Payment created',
            description: `${provider.name} accepted the orchestration request.`,
            correlationId,
          },
        },
      },
      include: { timeline: true },
    });

    await Promise.all([
      this.infrastructure.publish({
        type: 'payment.created',
        correlationId,
        payload: { paymentId: payment.id, amount, currency, status: payment.status },
      }),
      this.audit.record({
        action: 'payment.create',
        resource: 'payment',
        resourceId: payment.id,
        actor,
        request,
        metadata: { provider: provider.name, amount, currency },
      }),
    ]);
    return { ...payment, clientSecret: providerResult.clientSecret };
  }

  async cancel(
    id: string,
    actor: AuthTokenPayload,
    request: AuthenticatedRequest,
  ): Promise<unknown> {
    const payment = await this.infrastructure.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Only pending payments can be cancelled.');
    }
    if (payment.externalId) await resolvePaymentProvider().cancel(payment.externalId);
    const updated = await this.infrastructure.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.CANCELLED,
        timeline: {
          create: {
            type: TimelineEventType.PAYMENT_UPDATED,
            title: 'Payment cancelled',
            description: 'The pending payment was cancelled by an administrator.',
            correlationId: request.correlationId,
          },
        },
      },
    });
    await Promise.all([
      this.infrastructure.publish({
        type: 'payment.updated',
        correlationId: request.correlationId,
        payload: { paymentId: id, status: PaymentStatus.CANCELLED },
      }),
      this.audit.record({
        action: 'payment.cancel',
        resource: 'payment',
        resourceId: id,
        actor,
        request,
      }),
    ]);
    return updated;
  }
}
