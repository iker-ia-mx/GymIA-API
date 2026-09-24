import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateBodyMetricDto {
  @IsNumber()
  @Min(1)
  weightKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bodyFatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leanMassKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waistCm?: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
