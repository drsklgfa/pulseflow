import { Injectable } from '@nestjs/common';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import type { AuthenticatedRequest } from './authenticated-request';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@Injectable()
export class AuditService {
  constructor(private readonly infrastructure: InfrastructureService) {}

  async record(input: {
    action: string;
    resource: string;
    resourceId?: string;
    actor?: AuthTokenPayload;
    request?: AuthenticatedRequest;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.infrastructure.prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        actorId: input.actor?.sub,
        ipAddress: input.request?.ip,
        userAgent: input.request?.header('user-agent')?.slice(0, 300),
        metadata: input.metadata,
      },
    });
  }
}
