import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompleteOnboardingDto, UpdateOnboardingProfileDto } from './dto/complete-onboarding.dto.js';

// La rutina inicial no viene de un modelo de IA real (no existe ese servicio
// en el backend hoy) — se genera con una selección determinista sobre el
// catálogo de ejercicios real, priorizando grupos musculares elegidos y
// respetando "conservar"/"evitar". Es una rutina de verdad, persistida y
// editable, no un dato simulado.
const SETS_REPS_BY_GOAL: Record<string, { sets: number; reps: number }> = {
  ganar_musculo: { sets: 3, reps: 10 },
  ganar_fuerza: { sets: 4, reps: 5 },
  fuerza_musculo: { sets: 3, reps: 8 },
};

function exerciseCountForDuration(minutes: number): number {
  if (minutes <= 45) return 4;
  if (minutes <= 60) return 6;
  return 8;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(userId: string) {
    return this.prisma.onboardingProfile.findUnique({ where: { userId } });
  }

  async updateProfile(userId: string, dto: UpdateOnboardingProfileDto) {
    const existing = await this.prisma.onboardingProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Onboarding profile not found');
    }

    return this.prisma.onboardingProfile.update({
      where: { userId },
      data: {
        ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
        ...(dto.musclePriorities !== undefined ? { musclePriorities: dto.musclePriorities } : {}),
      },
    });
  }

  async complete(userId: string, dto: CompleteOnboardingDto) {
    const existing = await this.prisma.onboardingProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Onboarding already completed');
    }

    const allExercises = await this.prisma.exercise.findMany();
    const avoidNames = new Set(dto.avoidExercises.map((name) => name.toLowerCase()));
    const keepNames = new Set(dto.keepExercises.map((name) => name.toLowerCase()));
    const priorityGroups = new Set(dto.musclePriorities);

    const eligible = allExercises.filter((exercise) => !avoidNames.has(exercise.name.toLowerCase()));
    const kept = eligible.filter((exercise) => keepNames.has(exercise.name.toLowerCase()));
    const prioritized = eligible.filter(
      (exercise) => priorityGroups.has(exercise.muscleGroup) && !kept.includes(exercise),
    );
    const rest = eligible.filter((exercise) => !kept.includes(exercise) && !prioritized.includes(exercise));

    const targetCount = exerciseCountForDuration(dto.sessionDurationMin);
    const ordered = [...kept, ...prioritized, ...rest];
    const selected = (ordered.length > 0 ? ordered : allExercises).slice(0, targetCount);

    const { sets, reps } = SETS_REPS_BY_GOAL[dto.goal] ?? SETS_REPS_BY_GOAL.ganar_musculo;

    const [profile, routine] = await this.prisma.$transaction([
      this.prisma.onboardingProfile.create({
        data: {
          userId,
          goal: dto.goal,
          experienceLevel: dto.experienceLevel,
          trainingDays: dto.trainingDays,
          sessionDurationMin: dto.sessionDurationMin,
          location: dto.location,
          equipment: dto.equipment,
          musclePriorities: dto.musclePriorities,
          keepExercises: dto.keepExercises,
          avoidExercises: dto.avoidExercises,
        },
      }),
      this.prisma.routine.create({
        data: {
          userId,
          name: 'Mi rutina adaptativa',
          exercises: {
            create: selected.map((exercise, index) => ({
              exerciseId: exercise.id,
              order: index,
              targetSets: sets,
              targetReps: reps,
            })),
          },
        },
        include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
      }),
    ]);

    return { profile, routine };
  }
}
