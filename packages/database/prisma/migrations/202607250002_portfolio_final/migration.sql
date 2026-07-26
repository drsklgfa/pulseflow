-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- AlterEnum
ALTER TYPE "TimelineEventType" ADD VALUE 'JOB_RETRIED';

-- AlterTable
ALTER TABLE "WebhookEvent"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN "processingError" TEXT;

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");
CREATE INDEX "Payment_provider_createdAt_idx" ON "Payment"("provider", "createdAt");
CREATE INDEX "WebhookEvent_provider_eventType_receivedAt_idx" ON "WebhookEvent"("provider", "eventType", "receivedAt");
CREATE INDEX "WebhookEvent_paymentId_receivedAt_idx" ON "WebhookEvent"("paymentId", "receivedAt");
CREATE INDEX "Notification_channel_createdAt_idx" ON "Notification"("channel", "createdAt");
CREATE INDEX "ProcessingEvent_type_createdAt_idx" ON "ProcessingEvent"("type", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
