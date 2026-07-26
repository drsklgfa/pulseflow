import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const incoming = request.header('x-correlation-id');
    request.correlationId = incoming && incoming.length <= 100 ? incoming : randomUUID();
    response.setHeader('x-correlation-id', request.correlationId);
    next();
  }
}
