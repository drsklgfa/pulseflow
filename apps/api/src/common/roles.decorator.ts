import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@pulseflow/contracts';

export const ROLES_KEY = 'pulseflow:roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
