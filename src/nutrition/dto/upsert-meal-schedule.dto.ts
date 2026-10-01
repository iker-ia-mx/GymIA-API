import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';

export const MEAL_SCHEDULE_TYPES = ['desayuno', 'comida', 'cena', 'snack'] as const;

export class UpsertMealScheduleEntryDto {
  @IsIn(MEAL_SCHEDULE_TYPES)
  mealType!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // "HH:mm", 24h
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeOfDay!: string;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}
