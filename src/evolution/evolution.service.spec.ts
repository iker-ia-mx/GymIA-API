import type { Mock } from 'vitest';
import { EvolutionService } from './evolution.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('EvolutionService', () => {
  let service: EvolutionService;
  let prisma: {
    setLog: { findMany: Mock };
    workoutSession: { count: Mock };
  };

  const userId = 'user-1';
  const exerciseA = { id: 'ex-a', name: 'Press de Banca' };
  const exerciseB = { id: 'ex-b', name: 'Sentadilla' };

  function completedSet(overrides: {
    weightKg: number;
    reps: number;
    completedAt: Date;
    exercise?: typeof exerciseA;
    sessionId?: string;
  }) {
    return {
      weightKg: overrides.weightKg,
      reps: overrides.reps,
      completedAt: overrides.completedAt,
      sessionExercise: {
        exerciseId: (overrides.exercise ?? exerciseA).id,
        exercise: overrides.exercise ?? exerciseA,
        sessionId: overrides.sessionId ?? 'session-1',
        session: { startedAt: overrides.completedAt },
      },
    };
  }

  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  }

  beforeEach(() => {
    prisma = {
      setLog: { findMany: vi.fn() },
      workoutSession: { count: vi.fn().mockResolvedValue(0) },
    };
    service = new EvolutionService(prisma as unknown as PrismaService);
  });

  describe('getSummary — récords recientes', () => {
    it('incluye un récord logrado hace 1 día (dentro de la ventana de 14 días)', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 10, completedAt: daysAgo(1) }),
      ]);

      const result = await service.getSummary(userId);

      expect(result.recentRecords).toEqual([
        expect.objectContaining({ exerciseId: exerciseA.id, weightKg: 50 }),
      ]);
    });

    it('excluye un récord logrado hace 20 días (fuera de la ventana de 14 días)', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 10, completedAt: daysAgo(20) }),
      ]);

      const result = await service.getSummary(userId);

      expect(result.recentRecords).toEqual([]);
    });

    it('reporta el peso máximo por ejercicio, no el más reciente', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 10, completedAt: daysAgo(3) }),
        completedSet({ weightKg: 60, reps: 5, completedAt: daysAgo(1) }),
        completedSet({ weightKg: 55, reps: 8, completedAt: daysAgo(2) }),
      ]);

      const result = await service.getSummary(userId);

      expect(result.recentRecords).toHaveLength(1);
      expect(result.recentRecords[0]).toMatchObject({ weightKg: 60 });
    });

    it('con historial vacío devuelve un resumen sin errores', async () => {
      prisma.setLog.findMany.mockResolvedValue([]);

      const result = await service.getSummary(userId);

      expect(result.recentRecords).toEqual([]);
      expect(result.sessionsLast7Days).toBe(0);
      expect(result.progressScore).toBeGreaterThanOrEqual(0);
    });

    it('acota la consulta a los últimos 21 días (01.02: "Evolution carga todas las series en cada petición")', async () => {
      prisma.setLog.findMany.mockResolvedValue([]);

      await service.getSummary(userId);

      expect(prisma.setLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completedAt: { gte: expect.any(Date) },
          }),
        }),
      );
      const call = prisma.setLog.findMany.mock.calls[0][0];
      const sinceArg: Date = call.where.completedAt.gte;
      const daysAgoArg = (Date.now() - sinceArg.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysAgoArg).toBeCloseTo(21, 0);
    });
  });

  describe('getSummary — volumen no infla con series muy antiguas', () => {
    it('una serie de hace 20 días no cuenta ni como semana actual ni anterior', async () => {
      // No verifica directamente weeklyVolume (privado), pero sí que no genere
      // un progressScore de "tendencia al alza" a partir de datos fuera de rango.
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 100, reps: 10, completedAt: daysAgo(20) }),
      ]);

      const result = await service.getSummary(userId);

      // Sin sesiones recientes y sin volumen de semana anterior -> score bajo (solo trendScore=20 por defecto)
      expect(result.progressScore).toBe(20);
    });
  });

  describe('getStrengthOverview — 1RM estimado (Epley)', () => {
    it('NO acota por fecha — los récords son de todo el historial, a diferencia de getSummary', async () => {
      prisma.setLog.findMany.mockResolvedValue([]);

      await service.getStrengthOverview(userId);

      const call = prisma.setLog.findMany.mock.calls[0][0];
      expect(call.where.completedAt).toBeUndefined();
    });

    it('calcula el 1RM con la fórmula de Epley', async () => {
      // weightKg * (1 + reps/30) => 100 * (1 + 5/30) = 116.66...
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 100, reps: 5, completedAt: daysAgo(1) }),
      ]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises).toEqual([
        expect.objectContaining({ exerciseId: exerciseA.id, currentEstimatedOneRepMax: 116.7 }),
      ]);
    });

    it('conserva el mejor 1RM estimado, no el de la serie más pesada en bruto', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        // 1RM: 100 * (1 + 1/30) = 103.3
        completedSet({ weightKg: 100, reps: 1, completedAt: daysAgo(3) }),
        // 1RM: 80 * (1 + 10/30) = 106.7  -> mayor 1RM aunque el peso bruto sea menor
        completedSet({ weightKg: 80, reps: 10, completedAt: daysAgo(1) }),
      ]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises[0].currentEstimatedOneRepMax).toBe(106.7);
    });

    it('ordena los ejercicios por 1RM descendente', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 5, completedAt: daysAgo(1), exercise: exerciseA }),
        completedSet({ weightKg: 150, reps: 5, completedAt: daysAgo(1), exercise: exerciseB }),
      ]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises.map((e) => e.exerciseId)).toEqual([exerciseB.id, exerciseA.id]);
    });

    it('con historial vacío devuelve una lista vacía de ejercicios', async () => {
      prisma.setLog.findMany.mockResolvedValue([]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises).toEqual([]);
      expect(result.weeklyVolumeKg).toBe(0);
    });

    it('incluye la fecha real (achievedAt) del set que produjo el récord actual', async () => {
      const recordDate = daysAgo(3);
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 100, reps: 1, completedAt: daysAgo(10) }),
        completedSet({ weightKg: 80, reps: 10, completedAt: recordDate }), // mayor 1RM
      ]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises[0].achievedAt).toEqual(recordDate);
    });

    it('usa session.startedAt como respaldo cuando el set no tiene completedAt', async () => {
      const sessionStart = daysAgo(5);
      prisma.setLog.findMany.mockResolvedValue([
        {
          weightKg: 100,
          reps: 5,
          completedAt: null,
          sessionExercise: {
            exerciseId: exerciseA.id,
            exercise: exerciseA,
            sessionId: 'session-1',
            session: { startedAt: sessionStart },
          },
        },
      ]);

      const result = await service.getStrengthOverview(userId);

      expect(result.exercises[0].achievedAt).toEqual(sessionStart);
    });
  });

  describe('getExerciseHistory', () => {
    it('con un ejercicio nunca entrenado devuelve historial vacío sin lanzar error', async () => {
      prisma.setLog.findMany.mockResolvedValue([]);

      const result = await service.getExerciseHistory(userId, 'never-trained');

      expect(result).toEqual({
        exerciseName: null,
        history: [],
        percentChange: 0,
        sessionHistory: [],
        totalSessions: 0,
      });
    });

    it('filtra correctamente por exerciseId, sin mezclar el historial de otro ejercicio', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 5, completedAt: daysAgo(1), exercise: exerciseA }),
        completedSet({ weightKg: 200, reps: 5, completedAt: daysAgo(1), exercise: exerciseB }),
      ]);

      const result = await service.getExerciseHistory(userId, exerciseA.id);

      expect(result.exerciseName).toBe(exerciseA.name);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].estimatedOneRepMax).not.toBe(
        200 * (1 + 5 / 30),
      );
    });

    it('percentChange es 0 cuando solo hay un punto de historial', async () => {
      prisma.setLog.findMany.mockResolvedValue([
        completedSet({ weightKg: 50, reps: 5, completedAt: daysAgo(1) }),
      ]);

      const result = await service.getExerciseHistory(userId, exerciseA.id);

      expect(result.percentChange).toBe(0);
    });
  });
});
