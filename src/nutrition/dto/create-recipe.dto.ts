import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const RECIPE_DIFFICULTIES = ['facil', 'medio', 'dificil'] as const;

export class RecipeIngredientInputDto {
  @IsString()
  @MinLength(1)
  foodId!: string;

  @Min(1)
  quantityG!: number;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  prepTimeMin?: number;

  @IsOptional()
  @IsIn(RECIPE_DIFFICULTIES)
  difficulty?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients!: RecipeIngredientInputDto[];
}
