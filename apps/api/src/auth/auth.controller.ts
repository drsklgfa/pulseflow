import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthTokenPayload } from '@pulseflow/contracts';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() input: LoginDto): Promise<Record<string, unknown>> {
    return this.authService.login(input);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthTokenPayload): AuthTokenPayload {
    return user;
  }
}
