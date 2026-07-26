import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createAccessToken, verifyPassword } from '@pulseflow/contracts';
import { InfrastructureService } from '../infrastructure/infrastructure.service';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly infrastructure: InfrastructureService) {}

  async login(input: LoginDto): Promise<Record<string, unknown>> {
    const email = input.email.trim().toLowerCase();
    const user = await this.infrastructure.prisma.user.findUnique({ where: { email } });
    if (!user?.active || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.infrastructure.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const expiresIn = Number(process.env.ACCESS_TOKEN_EXPIRES_SECONDS ?? 28_800);
    const accessToken = createAccessToken(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      process.env.AUTH_SECRET ?? 'pulseflow-development-auth-secret-change-me',
      expiresIn,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
