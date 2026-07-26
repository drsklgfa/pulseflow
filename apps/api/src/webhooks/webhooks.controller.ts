import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/public.decorator';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<Record<string, unknown>> {
    return this.webhooks.list(limit);
  }

  @Public()
  @Post(':provider')
  receive(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<Record<string, unknown>> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    return this.webhooks.receive(provider, rawBody, headers);
  }
}
