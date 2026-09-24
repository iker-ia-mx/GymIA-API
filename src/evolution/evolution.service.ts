import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const RECENT_RECORD_WINDOW_DAYS = 14;

type CompletedSet = {
  weightKg: number;
  reps: number;
  completedAt: Date | null;
  sessionExercise: {
    exerciseId: string;
    exercise: { name: string };
    sessionId: string;
    session: { startedAt: Date };
  };
};

function estimateOneRepMax(weightKg: number, reps: number): number {
  // Epley formula.
  return weightKg * (1 + reps / 30);
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diffToMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

@Injectable()
export class EvolutionService {
  constructor(private readonly prisma: PrismaService) {}

  private getCompletedSets(userId: string): Promise<CompletedSet[]> {
    return this.prisma.setLog.findMany({
      where: {
        completed: true,
        sessionExercise: { session: { userId } },
      },
      orderBy: { completedAt: 'asc' },
      select: {
        weightKg: true,
        reps: true,
        completedAt: true,
        sessionExercise: {
          select: {
            exerciseId: true,
            sessionId: true,
            exercise: { select: { name: true } },
            session: { select: { startedAt: true } },
          },
        },
      },
    });
  }

  async getSummary(userId: string) {
    const [completedSets, sessionsLast7Days] = await Promise.all([
      this.getCompletedSets(userId),
      this.prisma.workoutSession.count({
        where: {
          userId,
          status: 'completed',
          finishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const recentRecords = this.computeRecentRecords(completedSets);
    const volumeTrend = this.computeWeeklyVolume(completedSets);

    // Transparent, formula-based score (not a real AI model): rewards training
    // frequency this week and rewards an upward volume trend.
    const frequencyScore = Math.min(1, sessionsLast7Days / 4) * 60;
    const trendScore =
      volumeTrend.previousWeekVolumeKg === 0
        ? 20
        : volumeTrend.currentWeekVolumeKg >= volumeTrend.previousWeekVolumeKg
          ? 40
          : 15;
    const progressScore = Math.round(frequencyScore + trendScore);

    return {
      progressScore,
      sessionsLast7Days,
      recentRecords,
    };
  }

  async getStrengthOverview(userId: string) {
    const completedSets = await this.getCompletedSets(userId);
    const volumeTrend = this.computeWeeklyVolume(completedSets);

    const bestByExercise = new Map<string, { exerciseName: string; oneRepMax: number }>();
    for (const set of completedSets) {
      const exerciseId = set.sessionExercise.exerciseId;
      const oneRepMax = estimateOneRepMax(set.weightKg, set.reps);
      const current = bestByExercise.get(exerciseId);
      if (!current || oneRepMax > current.oneRepMax) {
        bestByExercise.set(exerciseId, {
          exerciseName: set.sessionExercise.exercise.name,
          oneRepMax,
        });
      }
    }

    const exercises = [...bestByExercise.entries()]
      .map(([exerciseId, value]) => ({
        exerciseId,
        exerciseName: value.exerciseName,
        currentEstimatedOneRepMax: Math.round(value.oneRepMax * 10) / 10,
      }))
      .sort((a, b) => b.currentEstimatedOneRepMax - a.currentEstimatedOneRepMax);

    return {
      weeklyVolumeKg: Math.round(volumeTrend.currentWeekVolumeKg),
      weeklyVolumeDeltaKg: Math.round(
        volumeTrend.currentWeekVolumeKg - volumeTrend.previousWeekVolumeKg,
      ),
      exercises,
    };
  }

  async getExerciseHistory(userId: string, exerciseId: string) {
    const completedSets = await this.getCompletedSets(userId);
    const exerciseSets = completedSets.filter(
      (set) => set.sessionExercise.exerciseId === exerciseId,
    );

    const bestByWeek = new Map<number, { weekStart: Date; oneRepMax: number }>();
    for (const set of exerciseSets) {
      if (!set.completedAt) continue;
      const weekStart = getWeekStart(set.completedAt);
      const key = weekStart.getTime();
      const oneRepMax = estimateOneRepMax(set.weightKg, set.reps);
      const current = bestByWeek.get(key);
      if (!current || oneRepMax > current.oneRepMax) {
        bestByWeek.set(key, { weekStart, oneRepMax });
      }
    }

    const history = [...bestByWeek.values()]
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((point) => ({
        weekStart: point.weekStart.toISOString(),
        estimatedOneRepMax: Math.round(point.oneRepMax * 10) / 10,
      }));

    const first = history.at(0);
    const last = history.at(-1);
    const percentChange =
      first && last && first.estimatedOneRepMax > 0
        ? Math.round(
            ((last.estimatedOneRepMax - first.estimatedOneRepMax) / first.estimatedOneRepMax) *
              100,
          )
        : 0;

    // Historial por sesión real (peso/reps/series realmente registrados). No
    // incluye RPE — el modelo de datos (SetLog) no lo captura, así que no se
    // inventa. "isPR" se calcula comparando contra el mejor peso de sesiones
    // anteriores, con datos reales, no una estimación.
    const sessionGroups = new Map<
      string,
      { startedAt: Date; sets: { weightKg: number; reps: number }[] }
    >();
    for (const set of exerciseSets) {
      const sessionId = set.sessionExercise.sessionId;
      const group = sessionGroups.get(sessionId);
      if (group) {
        group.sets.push({ weightKg: set.weightKg, reps: set.reps });
      } else {
        sessionGroups.set(sessionId, {
          startedAt: set.sessionExercise.session.startedAt,
          sets: [{ weightKg: set.weightKg, reps: set.reps }],
        });
      }
    }

    let runningBestWeightKg = 0;
    const sessionHistory = [...sessionGroups.entries()]
      .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime())
      .map(([sessionId, group]) => {
        const bestSet = group.sets.reduce((best, set) =>
          set.weightKg > best.weightKg ? set : best,
        );
        const isPR = bestSet.weightKg > runningBestWeightKg;
        if (isPR) runningBestWeightKg = bestSet.weightKg;
        return {
          sessionId,
          date: group.startedAt.toISOString(),
          bestSet,
          totalSets: group.sets.length,
          isPR,
        };
      })
      .reverse();

    return {
      exerciseName: exerciseSets[0]?.sessionExercise.exercise.name ?? null,
      history,
      percentChange,
      sessionHistory,
      totalSessions: sessionGroups.size,
    };
  }

  private computeRecentRecords(completedSets: CompletedSet[]) {
    const bestByExercise = new Map<
      string,
      { exerciseId: string; exerciseName: string; weightKg: number; achievedAt: Date }
    >();

    for (const set of completedSets) {
      if (!set.completedAt) continue;
      const exerciseId = set.sessionExercise.exerciseId;
      const current = bestByExercise.get(exerciseId);
      if (!current || set.weightKg > current.weightKg) {
        bestByExercise.set(exerciseId, {
          exerciseId,
          exerciseName: set.sessionExercise.exercise.name,
          weightKg: set.weightKg,
          achievedAt: set.completedAt,
        });
      }
    }

    const cutoff = Date.now() - RECENT_RECORD_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return [...bestByExercise.values()]
      .filter((record) => record.achievedAt.getTime() >= cutoff)
      .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime())
      .map((record) => ({
        exerciseId: record.exerciseId,
        exerciseName: record.exerciseName,
        weightKg: record.weightKg,
        achievedAt: record.achievedAt,
      }));
  }

  private computeWeeklyVolume(completedSets: CompletedSet[]) {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

    let currentWeekVolumeKg = 0;
    let previousWeekVolumeKg = 0;

    for (const set of completedSets) {
      if (!set.completedAt) continue;
      const volume = set.weightKg * set.reps;
      if (set.completedAt >= currentWeekStart) {
        currentWeekVolumeKg += volume;
      } else if (set.completedAt >= previousWeekStart) {
        previousWeekVolumeKg += volume;
      }
    }

    return { currentWeekVolumeKg, previousWeekVolumeKg };
  }
}
