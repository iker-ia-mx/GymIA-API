import { IsNumber, IsUUID, Min } from 'class-validator';

export class AddMealItemDto {
  @IsUUID()
  foodId!: string;

  @IsNumber()
  @Min(1)
  quantityG!: number;
}
