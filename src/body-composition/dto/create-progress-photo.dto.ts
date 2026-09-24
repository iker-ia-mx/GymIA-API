import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProgressPhotoDto {
  @IsString()
  @MinLength(1)
  storagePath!: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
