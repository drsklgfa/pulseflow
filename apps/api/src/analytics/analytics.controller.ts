import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiQuery({ name: 'days', required: false })
  get(
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ): Promise<Record<string, unknown>> {
    return this.analytics.get(days);
  }
}
