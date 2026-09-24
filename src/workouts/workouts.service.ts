import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoutineDto } from './dto/create-routine.dto.js';
import { UpdateSetDto } from './dto/update-set.dto.js';

const sessionInclude = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: true,
      sets: { orderBy: { setNumber: 'asc' as const } },
    },
  },
};

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  getExercises() {
    return this.prisma.exercise.findMany({ orderBy: { name: 'asc' } });
  }

  getRoutines(userId: string) {
    return this.prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: { exercise: true },
        },
      },
    });
  }

  async createRoutine(userId: string, dto: CreateRoutineDto) {
    return this.prisma.routine.create({
      data: {
        userId,
        name: dto.name,
        exercises: {
          create: dto.exercises.map((exercise, index) => ({
            exerciseId: exercise.exerciseId,
            order: index,
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
          })),
        },
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: { exercise: true },
        },
      },
    });
  }

  getActiveSession(userId: string) {
    return this.prisma.workoutSession.findFirst({
      where: { userId, status: 'in_progress' },
      include: sessionInclude,
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: sessionInclude,
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('This session does not belong to you');
    }

    return session;
  }

  async startSession(userId: string, routineId: string) {
    const existingActive = await this.prisma.workoutSession.findFirst({
      where: { userId, status: 'in_progress' },
    });
    if (existingActive) {
      throw new ConflictException('You already have a workout in progress');
    }

    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (routine.userId !== userId) {
      throw new ForbiddenException('This routine does not belong to you');
    }

    const sessionExerciseData = await Promise.all(
      routine.exercises.map(async (routineExercise) => {
        const lastWeight = await this.getBestWeightForExercise(userId, routineExercise.exerciseId);
        return {
          exerciseId: routineExercise.exerciseId,
          order: routineExercise.order,
          sets: {
            create: Array.from({ length: routineExercise.targetSets }, (_, index) => ({
              setNumber: index + 1,
              weightKg: lastWeight ?? 0,
              reps: routineExercise.targetReps,
              completed: false,
            })),
          },
        };
      }),
    );

    return this.prisma.workoutSession.create({
      data: {
        userId,
        routineId: routine.id,
        exercises: { create: sessionExerciseData },
      },
      include: sessionInclude,
    });
  }

  async addSet(userId: string, sessionId: string, sessionExerciseId: string) {
    const session = await this.getSession(userId, sessionId);
    const sessionExercise = session.exercises.find((ex) => ex.id === sessionExerciseId);
    if (!sessionExercise) {
      throw new NotFoundException('Exercise not found in this session');
    }

    const lastSet = sessionExercise.sets.at(-1);

    return this.prisma.setLog.create({
      data: {
        sessionExerciseId,
        setNumber: (lastSet?.setNumber ?? 0) + 1,
        weightKg: lastSet?.weightKg ?? 0,
        reps: lastSet?.reps ?? 8,
        completed: false,
      },
    });
  }

  async updateSet(userId: string, sessionId: string, setLogId: string, dto: UpdateSetDto) {
    const session = await this.getSession(userId, sessionId);
    const setLog = session.exercises.flatMap((ex) => ex.sets).find((set) => set.id === setLogId);
    if (!setLog) {
      throw new NotFoundException('Set not found in this session');
    }

    const willBeCompleted = dto.completed ?? setLog.completed;

    return this.prisma.setLog.update({
      where: { id: setLogId },
      data: {
        ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
        ...(dto.reps !== undefined ? { reps: dto.reps } : {}),
        ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
        completedAt: willBeCompleted ? (setLog.completedAt ?? new Date()) : null,
      },
    });
  }

  async finishSession(userId: string, sessionId: string) {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'in_progress') {
      throw new ConflictException('This session is not in progress');
    }

    const finishedAt = new Date();
    const allSets = session.exercises.flatMap((ex) => ex.sets);
    const completedSets = allSets.filter((set) => set.completed);
    const totalVolumeKg = completedSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);

    const personalRecords: { exerciseName: string; weightKg: number }[] = [];
    for (const sessionExercise of session.exercises) {
      const bestThisSession = Math.max(
        0,
        ...sessionExercise.sets.filter((set) => set.completed).map((set) => set.weightKg),
      );
      if (bestThisSession <= 0) continue;

      const previousBest = await this.getBestWeightForExercise(
        userId,
        sessionExercise.exerciseId,
        sessionId,
      );
      if (previousBest === null || bestThisSession > previousBest) {
        personalRecords.push({
          exerciseName: sessionExercise.exercise.name,
          weightKg: bestThisSession,
        });
      }
    }

    const updatedSession = await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: 'completed', finishedAt },
      include: sessionInclude,
    });

    return {
      session: updatedSession,
      durationSeconds: Math.max(
        0,
        Math.floor((finishedAt.getTime() - session.startedAt.getTime()) / 1000),
      ),
      totalSets: allSets.length,
      completedSets: completedSets.length,
      totalVolumeKg,
      personalRecords,
    };
  }

  private async getBestWeightForExercise(
    userId: string,
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<number | null> {
    const best = await this.prisma.setLog.findFirst({
      where: {
        completed: true,
        sessionExercise: {
          exerciseId,
          session: {
            userId,
            ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
          },
        },
      },
      orderBy: { weightKg: 'desc' },
    });

    return best?.weightKg ?? null;
  }
}
