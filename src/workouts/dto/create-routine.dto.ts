import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RoutineExerciseInputDto {
  @IsUUID()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  targetSets!: number;

  @IsInt()
  @Min(1)
  targetReps!: number;
}

export class CreateRoutineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @ValidateNested({ each: true })
  @Type(() => RoutineExerciseInputDto)
  @ArrayMinSize(1)
  exercises!: RoutineExerciseInputDto[];
}
