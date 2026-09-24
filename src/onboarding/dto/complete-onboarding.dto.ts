import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const ONBOARDING_GOALS = ['ganar_musculo', 'ganar_fuerza', 'fuerza_musculo'] as const;
export const ONBOARDING_EXPERIENCE_LEVELS = ['principiante', 'intermedio'] as const;
export const ONBOARDING_LOCATIONS = [
  'gimnasio_completo',
  'gimnasio_basico',
  'casa',
  'personalizado',
] as const;
export const ONBOARDING_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export class CompleteOnboardingDto {
  @IsIn(ONBOARDING_GOALS)
  goal!: string;

  @IsIn(ONBOARDING_EXPERIENCE_LEVELS)
  experienceLevel!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ONBOARDING_DAYS, { each: true })
  trainingDays!: string[];

  @IsInt()
  @Min(15)
  sessionDurationMin!: number;

  @IsIn(ONBOARDING_LOCATIONS)
  location!: string;

  @IsArray()
  @IsString({ each: true })
  equipment!: string[];

  @IsArray()
  @IsString({ each: true })
  musclePriorities!: string[];

  @IsArray()
  @IsString({ each: true })
  keepExercises!: string[];

  @IsArray()
  @IsString({ each: true })
  avoidExercises!: string[];
}

export class UpdateOnboardingProfileDto {
  @IsOptional()
  @IsIn(ONBOARDING_GOALS)
  goal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  musclePriorities?: string[];
}
