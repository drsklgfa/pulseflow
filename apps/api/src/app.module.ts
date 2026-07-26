import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuditController } from './common/audit.controller';
import { AuditService } from './common/audit.service';
import { AuthGuard } from './common/auth.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { RolesGuard } from './common/roles.guard';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { HealthController } from './health/health.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LabController } from './lab/lab.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { QueuesController } from './queues/queues.controller';
import { QueuesService } from './queues/queues.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [
    HealthController,
    AuthController,
    DashboardController,
    AnalyticsController,
    PaymentsController,
    NotificationsController,
    QueuesController,
    WebhooksController,
    LabController,
    AuditController,
  ],
  providers: [
    AuthService,
    AuditService,
    DashboardService,
    AnalyticsService,
    PaymentsService,
    NotificationsService,
    QueuesService,
    WebhooksService,
    RealtimeGateway,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
