CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WEBHOOK');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
CREATE TYPE "TimelineEventType" AS ENUM ('PAYMENT_CREATED', 'PAYMENT_UPDATED', 'WEBHOOK_RECEIVED', 'WEBHOOK_REJECTED', 'JOB_QUEUED', 'JOB_STARTED', 'NOTIFICATION_SENT', 'JOB_FAILED');

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentId" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipient" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 4,
  "queueJobId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingEvent" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "type" "TimelineEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_customerEmail_idx" ON "Payment"("customerEmail");
CREATE UNIQUE INDEX "WebhookEvent_externalEventId_key" ON "WebhookEvent"("externalEventId");
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");
CREATE UNIQUE INDEX "Notification_queueJobId_key" ON "Notification"("queueJobId");
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX "ProcessingEvent_paymentId_createdAt_idx" ON "ProcessingEvent"("paymentId", "createdAt");
CREATE INDEX "ProcessingEvent_correlationId_idx" ON "ProcessingEvent"("correlationId");

ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
