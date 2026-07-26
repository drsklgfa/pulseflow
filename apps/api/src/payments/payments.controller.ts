import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<Record<string, unknown>> {
    return this.paymentsService.list({ status, search, page, pageSize });
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<unknown> {
    return this.paymentsService.getById(id);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Body() input: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() actor: AuthTokenPayload,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.paymentsService.create(input, idempotencyKey, actor, request);
  }

  @Post(':id/cancel')
  @Roles('ADMIN')
  cancel(
    @Param('id') id: string,
    @CurrentUser() actor: AuthTokenPayload,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.paymentsService.cancel(id, actor, request);
  }
}
