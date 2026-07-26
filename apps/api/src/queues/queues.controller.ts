import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/roles.decorator';
import { QueuesService } from './queues.service';

@ApiTags('queues')
@ApiBearerAuth()
@Controller('queues')
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  overview(): Promise<Record<string, unknown>> {
    return this.queues.overview();
  }

  @Get('failed')
  failed(): Promise<unknown[]> {
    return this.queues.failed();
  }

  @Post('pause')
  @Roles('ADMIN')
  pause(): Promise<Record<string, unknown>> {
    return this.queues.pause();
  }

  @Post('resume')
  @Roles('ADMIN')
  resume(): Promise<Record<string, unknown>> {
    return this.queues.resume();
  }

  @Post('clean')
  @Roles('ADMIN')
  clean(): Promise<Record<string, unknown>> {
    return this.queues.clean();
  }
}
