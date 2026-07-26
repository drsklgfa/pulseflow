import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import type { AuthenticatedRequest } from './authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
