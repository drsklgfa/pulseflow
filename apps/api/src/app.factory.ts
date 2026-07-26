import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

export async function createPulseFlowApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin: string) => origin.trim());

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: corsOrigins, credentials: false });
  app.enableShutdownHooks();
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('cross-origin-opener-policy', 'same-origin');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.DISABLE_SWAGGER !== 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PulseFlow API')
      .setDescription(
        'Payment, signed webhook, BullMQ queue, notification and realtime orchestration API.',
      )
      .setVersion(process.env.APP_VERSION ?? '1.0.1')
      .addBearerAuth()
      .addTag('health')
      .addTag('auth')
      .addTag('dashboard')
      .addTag('analytics')
      .addTag('payments')
      .addTag('webhooks')
      .addTag('notifications')
      .addTag('queues')
      .addTag('lab')
      .addTag('audit')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      customSiteTitle: 'PulseFlow API Documentation',
    });
  }
  return app;
}
