import { IsIn, IsOptional, IsString } from 'class-validator';
import type { FailureMode } from '@pulseflow/contracts';

export class SimulateEventDto {
  @IsString()
  @IsIn(['APPROVED', 'DECLINED'])
  status!: 'APPROVED' | 'DECLINED';

  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'FAIL_ONCE', 'FAIL_ALWAYS', 'TIMEOUT'])
  failureMode: FailureMode = 'NONE';
}
