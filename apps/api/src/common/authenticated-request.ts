import type { Request } from 'express';
import type { AuthTokenPayload } from '@pulseflow/contracts';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
  correlationId: string;
}
