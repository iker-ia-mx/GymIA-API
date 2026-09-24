import { IsDateString, IsIn, IsOptional } from 'class-validator';

const MEAL_TYPES = ['desayuno', 'comida', 'cena', 'snack'] as const;

export class CreateMealDto {
  @IsIn(MEAL_TYPES)
  mealType!: (typeof MEAL_TYPES)[number];

  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
