import { IsBoolean, IsOptional } from 'class-validator';

// El cliente móvil llama esto DESPUÉS de que el sistema operativo (no
// GymIA) ya mostró su propio diálogo nativo de permisos de HealthKit/Health
// Connect — este endpoint solo registra qué permisos quedaron concedidos.
// Nunca es un callback de OAuth (a diferencia de Oura, fuera del MVP), ver
// docs/SLEEP_PRODUCT_SPEC.md §7.
export class ConnectSleepSourceDto {
  @IsOptional()
  @IsBoolean()
  grantsSleepAnalysis?: boolean;

  @IsOptional()
  @IsBoolean()
  grantsHeartRate?: boolean;

  @IsOptional()
  @IsBoolean()
  grantsRespiratoryRate?: boolean;

  @IsOptional()
  @IsBoolean()
  grantsHrv?: boolean;
}
