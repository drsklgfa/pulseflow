import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly infrastructure: InfrastructureService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false })
  list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number): Promise<unknown> {
    return this.infrastructure.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit ?? 30)),
      include: { actor: { select: { name: true, email: true, role: true } } },
    });
  }
}
