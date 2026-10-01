import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const SLEEP_SOURCES = ['apple_health', 'health_connect'] as const;
export const SLEEP_STAGES = ['ligero', 'profundo', 'rem', 'despierto'] as const;

export class SleepStageEventInputDto {
  @IsIn(SLEEP_STAGES)
  stage!: string;

  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

// Importación de una sesión ya finalizada, tal como la devuelve una lectura
// histórica de HealthKit/Health Connect — no hay creación incremental en
// vivo en el MVP (ver docs/SLEEP_PRODUCT_SPEC.md §8, alcance MVP).
export class ImportSleepSessionDto {
  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeInBedMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sleepEfficiencyPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recoveryScorePct?: number;

  @IsOptional()
  @IsNumber()
  avgHeartRateBpm?: number;

  @IsOptional()
  @IsNumber()
  minHeartRateBpm?: number;

  @IsOptional()
  @IsNumber()
  hrvMs?: number;

  @IsOptional()
  @IsNumber()
  respiratoryRateBpm?: number;

  @IsOptional()
  @IsString()
  dataQuality?: string;

  @IsIn(SLEEP_SOURCES)
  source!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SleepStageEventInputDto)
  stages?: SleepStageEventInputDto[];
}
