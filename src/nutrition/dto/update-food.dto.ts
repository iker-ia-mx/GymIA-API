import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateFoodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  caloriesKcal?: number;

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

  @IsOptional()
  @IsNumber()
  @Min(1)
  servingSizeG?: number;
}
