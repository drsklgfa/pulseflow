import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RetryNotificationDto } from './dto/retry-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'channel', required: false })
  list(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<Record<string, unknown>> {
    return this.notifications.list({ status, channel, page, pageSize });
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<unknown> {
    return this.notifications.getById(id);
  }

  @Post(':id/retry')
  @Roles('ADMIN')
  retry(
    @Param('id') id: string,
    @Body() input: RetryNotificationDto,
    @CurrentUser() actor: AuthTokenPayload,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.notifications.retry(id, actor, request, input.reason);
  }
}
