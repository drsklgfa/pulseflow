import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { InfrastructureService } from '../infrastructure/infrastructure.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly infrastructure: InfrastructureService) {}

  @Get('live')
  live(): Record<string, unknown> {
    return {
      status: 'ok',
      service: process.env.APP_NAME ?? 'PulseFlow',
      version: process.env.APP_VERSION ?? '1.0.1',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  root(): Promise<Record<string, unknown>> {
    return this.ready();
  }

  @Get('ready')
  async ready(): Promise<Record<string, unknown>> {
    const startedAt = performance.now();
    try {
      await this.infrastructure.prisma.$queryRawUnsafe('SELECT 1');
      const redis = await this.infrastructure.redis.ping();
      return {
        status: redis === 'PONG' ? 'ok' : 'degraded',
        service: process.env.APP_NAME ?? 'PulseFlow',
        version: process.env.APP_VERSION ?? '1.0.1',
        mode: process.env.APP_MODE ?? 'demo',
        dependencies: { postgres: 'up', redis: redis === 'PONG' ? 'up' : 'degraded' },
        responseTimeMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'Dependency check failed.',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
