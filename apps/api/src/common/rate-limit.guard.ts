import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const now = Date.now();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1_000;
    const limit = request.path.includes('/auth/login')
      ? Number(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS ?? 10)
      : Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);
    const key = `${request.ip}:${request.method}:${request.path}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException('Rate limit exceeded. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (this.buckets.size > 5_000) {
      for (const [entryKey, entry] of this.buckets) {
        if (entry.resetAt <= now) this.buckets.delete(entryKey);
      }
    }
    return true;
  }
}
