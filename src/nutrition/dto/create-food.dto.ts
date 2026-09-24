import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateFoodDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  caloriesKcal!: number;

  @IsNumber()
  @Min(0)
  proteinG!: number;

  @IsNumber()
  @Min(0)
  carbsG!: number;

  @IsNumber()
  @Min(0)
  fatG!: number;

  // Gramaje al que corresponden las macros de arriba. Si se omite, se asume
  // el estándar de etiqueta nutricional: por 100g.
  @IsOptional()
  @IsNumber()
  @Min(1)
  servingSizeG?: number;
}
