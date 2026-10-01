import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateSquadDto {
  @IsString()
  @Length(3, 60)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
