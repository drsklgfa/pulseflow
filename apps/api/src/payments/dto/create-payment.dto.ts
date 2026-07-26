import { Transform } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @MinLength(2)
  @Length(2, 120)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency = 'BRL';

  @IsOptional()
  @IsString()
  @Length(8, 120)
  idempotencyKey?: string;
}
