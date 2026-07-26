import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  canTransitionPayment,
  createWebhookSignature,
  verifyStripeSignature,
  verifyWebhookSignature,
  type FailureMode,
  type PaymentState,
} from '@pulseflow/contracts';
import { PaymentStatus, TimelineEventType } from '@pulseflow/database';
import type { Prisma } from '@pulseflow/database';
import { InfrastructureService } from '../infrastructure/infrastructure.service';
import { NotificationsService } from '../notifications/notifications.service';

interface NormalizedWebhook {
  externalEventId: string;
  eventType: string;
  paymentId?: string;
  externalPaymentId?: string;
  status?: PaymentStatus;
  payload: Prisma.InputJsonObject;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly infrastructure: InfrastructureService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(limit = 50): Promise<Record<string, unknown>> {
    const take = Math.min(100, Math.max(1, limit));
    const [items, total] = await Promise.all([
      this.infrastructure.prisma.webhookEvent.findMany({
        orderBy: { receivedAt: 'desc' },
        take,
        include: { payment: { select: { customerName: true, customerEmail: true } } },
      }),
      this.infrastructure.prisma.webhookEvent.count(),
    ]);
    return { items, total };
  }

  async receive(
    provider: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    failureMode: FailureMode = 'NONE',
  ): Promise<Record<string, unknown>> {
    const normalizedProvider = provider.toLowerCase();
    const payload = this.parse(rawBody);
    const event = this.normalize(normalizedProvider, payload);
    const valid = this.verify(normalizedProvider, rawBody, headers);

    if (!valid) {
      const matchingPaymentId = event.paymentId
        ? (await this.infrastructure.prisma.payment.count({ where: { id: event.paymentId } })) > 0
          ? event.paymentId
          : undefined
        : undefined;
      await this.infrastructure.prisma.webhookEvent.create({
        data: {
          externalEventId: `${event.externalEventId}:rejected:${randomUUID()}`,
          provider: normalizedProvider,
          eventType: event.eventType,
          signatureValid: false,
          payload: payload as Prisma.InputJsonValue,
          processingError: 'Signature validation failed.',
          paymentId: matchingPaymentId,
        },
      });
      if (matchingPaymentId) {
          await this.infrastructure.prisma.processingEvent.create({
            data: {
              paymentId: matchingPaymentId,
              type: TimelineEventType.WEBHOOK_REJECTED,
              title: 'Webhook rejected',
              description: `${normalizedProvider} signature verification failed.`,
              correlationId: randomUUID(),
            },
          });
      }
      throw new UnauthorizedException('Webhook signature is invalid.');
    }

    const duplicate = await this.infrastructure.prisma.webhookEvent.findUnique({
      where: { externalEventId: event.externalEventId },
    });
    if (duplicate) return { status: 'duplicate', eventId: duplicate.id };

    const payment = event.paymentId
      ? await this.infrastructure.prisma.payment.findUnique({ where: { id: event.paymentId } })
      : event.externalPaymentId
        ? await this.infrastructure.prisma.payment.findUnique({
            where: { externalId: event.externalPaymentId },
          })
        : null;

    if (!payment) {
      const stored = await this.infrastructure.prisma.webhookEvent.create({
        data: {
          externalEventId: event.externalEventId,
          provider: normalizedProvider,
          eventType: event.eventType,
          signatureValid: true,
          payload: payload as Prisma.InputJsonValue,
          processedAt: new Date(),
          processingError: 'No matching PulseFlow payment was found.',
        },
      });
      return { status: 'accepted_unmatched', eventId: stored.id };
    }

    const correlationId = randomUUID();
    const canTransition =
      event.status && canTransitionPayment(payment.status as PaymentState, event.status as PaymentState);

    await this.infrastructure.prisma.$transaction(async (transaction) => {
      await transaction.webhookEvent.create({
        data: {
          externalEventId: event.externalEventId,
          provider: normalizedProvider,
          eventType: event.eventType,
          signatureValid: true,
          payload: payload as Prisma.InputJsonValue,
          processedAt: new Date(),
          paymentId: payment.id,
        },
      });
      await transaction.processingEvent.create({
        data: {
          paymentId: payment.id,
          type: TimelineEventType.WEBHOOK_RECEIVED,
          title: 'Webhook accepted',
          description: `${event.eventType} passed signature and replay protection.`,
          correlationId,
          metadata: { provider: normalizedProvider, eventId: event.externalEventId },
        },
      });
      if (canTransition && event.status) {
        await transaction.payment.update({
          where: { id: payment.id },
          data: { status: event.status },
        });
        await transaction.processingEvent.create({
          data: {
            paymentId: payment.id,
            type: TimelineEventType.PAYMENT_UPDATED,
            title: `Payment ${event.status.toLowerCase()}`,
            description: 'The provider event advanced the payment state exactly once.',
            correlationId,
          },
        });
      }
    });

    if (canTransition && event.status && event.status !== PaymentStatus.CANCELLED) {
      await this.notifications.queueForPayment({
        paymentId: payment.id,
        customerEmail: payment.customerEmail,
        status: event.status,
        correlationId,
        failureMode,
      });
    }

    await this.infrastructure.publish({
      type: 'webhook.received',
      correlationId,
      payload: {
        paymentId: payment.id,
        eventId: event.externalEventId,
        eventType: event.eventType,
        status: event.status ?? payment.status,
      },
    });
    if (canTransition && event.status) {
      await this.infrastructure.publish({
        type: 'payment.updated',
        correlationId,
        payload: { paymentId: payment.id, status: event.status },
      });
    }

    return {
      status: canTransition ? 'processed' : 'accepted_no_transition',
      paymentId: payment.id,
      eventId: event.externalEventId,
    };
  }

  async simulate(
    paymentId: string,
    status: 'APPROVED' | 'DECLINED',
    failureMode: FailureMode = 'NONE',
  ): Promise<Record<string, unknown>> {
    const body = Buffer.from(
      JSON.stringify({
        id: `mock_evt_${randomUUID().replaceAll('-', '')}`,
        type: `payment.${status.toLowerCase()}`,
        data: { paymentId, status },
      }),
    );
    const secret = process.env.WEBHOOK_SECRET ?? 'pulseflow-demo-webhook-secret';
    return this.receive(
      'mock',
      body,
      { 'x-pulseflow-signature': createWebhookSignature(body, secret) },
      failureMode,
    );
  }

  async simulateInvalid(paymentId: string): Promise<Record<string, unknown>> {
    const body = Buffer.from(
      JSON.stringify({
        id: `mock_evt_invalid_${randomUUID().replaceAll('-', '')}`,
        type: 'payment.approved',
        data: { paymentId, status: 'APPROVED' },
      }),
    );
    try {
      await this.receive('mock', body, { 'x-pulseflow-signature': 'invalid-signature' });
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        return { status: 'rejected_as_expected', paymentId };
      }
      throw error;
    }
    return { status: 'unexpectedly_accepted', paymentId };
  }

  private parse(rawBody: Buffer): Prisma.InputJsonObject {
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Webhook body must be a JSON object.');
      }
      return parsed as Prisma.InputJsonObject;
    } catch {
      throw new UnauthorizedException('Webhook payload is not valid JSON.');
    }
  }

  private verify(
    provider: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const first = (value: string | string[] | undefined): string =>
      Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    if (provider === 'stripe') {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      return Boolean(
        secret && verifyStripeSignature(rawBody, first(headers['stripe-signature']), secret),
      );
    }
    return verifyWebhookSignature(
      rawBody,
      first(headers['x-pulseflow-signature']),
      process.env.WEBHOOK_SECRET ?? 'pulseflow-demo-webhook-secret',
    );
  }

  private normalize(provider: string, payload: Prisma.InputJsonObject): NormalizedWebhook {
    if (provider === 'stripe') {
      const data = payload.data as { object?: Prisma.InputJsonObject } | undefined;
      const object = data?.object ?? {};
      const metadata = (object.metadata ?? {}) as Prisma.InputJsonObject;
      const type = String(payload.type ?? 'stripe.unknown');
      const status =
        type === 'payment_intent.succeeded'
          ? PaymentStatus.APPROVED
          : type === 'payment_intent.payment_failed'
            ? PaymentStatus.DECLINED
            : type === 'payment_intent.canceled'
              ? PaymentStatus.CANCELLED
              : undefined;
      return {
        externalEventId: String(payload.id ?? `stripe_evt_${randomUUID()}`),
        eventType: type,
        paymentId: typeof metadata.pulseflow_payment_id === 'string' ? metadata.pulseflow_payment_id : undefined,
        externalPaymentId: typeof object.id === 'string' ? object.id : undefined,
        status,
        payload,
      };
    }
    const data = (payload.data ?? {}) as Prisma.InputJsonObject;
    const statusValue = String(data.status ?? '').toUpperCase();
    const status = Object.values(PaymentStatus).includes(statusValue as PaymentStatus)
      ? (statusValue as PaymentStatus)
      : undefined;
    return {
      externalEventId: String(payload.id ?? `mock_evt_${randomUUID()}`),
      eventType: String(payload.type ?? 'mock.unknown'),
      paymentId: typeof data.paymentId === 'string' ? data.paymentId : undefined,
      status,
      payload,
    };
  }
}
