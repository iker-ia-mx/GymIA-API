import { IsNumber, IsOptional, Min } from 'class-validator';

export class CreateNutritionGoalDto {
  @IsNumber()
  @Min(1)
  dailyCaloriesKcal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fatG?: number;
}
