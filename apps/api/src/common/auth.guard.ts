import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyAccessToken } from '@pulseflow/contracts';
import type { AuthenticatedRequest } from './authenticated-request';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Bearer token required.');

    try {
      request.user = verifyAccessToken(
        token,
        process.env.AUTH_SECRET ?? 'pulseflow-development-auth-secret-change-me',
      );
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }
  }
}
