import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/roles.decorator';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SimulateEventDto } from './dto/simulate-event.dto';

@ApiTags('lab')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('lab')
export class LabController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('payments/:id/event')
  simulate(
    @Param('id') id: string,
    @Body() input: SimulateEventDto,
  ): Promise<Record<string, unknown>> {
    return this.webhooks.simulate(id, input.status, input.failureMode);
  }

  @Post('payments/:id/invalid-signature')
  invalidSignature(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.webhooks.simulateInvalid(id);
  }
}
