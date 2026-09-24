import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { WorkoutsService } from './workouts.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let prisma: {
    exercise: { findMany: Mock };
    routine: { findMany: Mock; create: Mock; findUnique: Mock };
    workoutSession: { findFirst: Mock; findUnique: Mock; create: Mock; update: Mock };
    setLog: { create: Mock; update: Mock; findFirst: Mock };
  };

  const userId = 'user-1';
  const otherUserId = 'user-2';

  const exercise = { id: 'ex-1', name: 'Press de Banca', muscleGroup: 'Pecho' };

  function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'session-1',
      userId,
      routineId: 'routine-1',
      status: 'in_progress',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: null,
      exercises: [
        {
          id: 'session-ex-1',
          exerciseId: exercise.id,
          exercise,
          sets: [
            { id: 'set-1', setNumber: 1, weightKg: 40, reps: 10, completed: true, completedAt: new Date() },
            { id: 'set-2', setNumber: 2, weightKg: 45, reps: 8, completed: false, completedAt: null },
          ],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      exercise: { findMany: vi.fn() },
      routine: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
      workoutSession: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      setLog: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    };

    service = new WorkoutsService(prisma as unknown as PrismaService);
  });

  describe('getSession', () => {
    it('devuelve la sesión cuando pertenece al usuario', async () => {
      const session = makeSession();
      prisma.workoutSession.findUnique.mockResolvedValue(session);

      await expect(service.getSession(userId, session.id)).resolves.toEqual(session);
    });

    it('lanza NotFoundException si la sesión no existe', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la sesión pertenece a otro usuario', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession());

      await expect(service.getSession(otherUserId, 'session-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('startSession', () => {
    it('lanza ConflictException si ya hay una sesión en progreso', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(makeSession());

      await expect(service.startSession(userId, 'routine-1')).rejects.toThrow(ConflictException);
      expect(prisma.routine.findUnique).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la rutina no existe', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(service.startSession(userId, 'missing-routine')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza ForbiddenException si la rutina pertenece a otro usuario', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.routine.findUnique.mockResolvedValue({
        id: 'routine-1',
        userId: otherUserId,
        exercises: [],
      });

      await expect(service.startSession(userId, 'routine-1')).rejects.toThrow(ForbiddenException);
    });

    it('crea la sesión con series pre-cargadas al mejor peso previo del usuario', async () => {
      prisma.workoutSession.findFirst.mockResolvedValueOnce(null); // sin sesión activa
      prisma.routine.findUnique.mockResolvedValue({
        id: 'routine-1',
        userId,
        exercises: [{ exerciseId: exercise.id, order: 0, targetSets: 2, targetReps: 10 }],
      });
      // getBestWeightForExercise -> findFirst sobre setLog
      prisma.setLog.findFirst.mockResolvedValue({ weightKg: 50 });
      prisma.workoutSession.create.mockResolvedValue(makeSession());

      await service.startSession(userId, 'routine-1');

      expect(prisma.workoutSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            routineId: 'routine-1',
            exercises: {
              create: [
                expect.objectContaining({
                  exerciseId: exercise.id,
                  sets: {
                    create: [
                      expect.objectContaining({ setNumber: 1, weightKg: 50, reps: 10, completed: false }),
                      expect.objectContaining({ setNumber: 2, weightKg: 50, reps: 10, completed: false }),
                    ],
                  },
                }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe('updateSet', () => {
    it('al marcar una serie como completada, fija completedAt si no tenía uno', async () => {
      const session = makeSession();
      prisma.workoutSession.findUnique.mockResolvedValue(session);
      prisma.setLog.update.mockResolvedValue({});

      await service.updateSet(userId, session.id, 'set-2', { completed: true });

      expect(prisma.setLog.update).toHaveBeenCalledWith({
        where: { id: 'set-2' },
        data: expect.objectContaining({
          completed: true,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('al marcar una serie como incompleta, limpia completedAt', async () => {
      const session = makeSession();
      prisma.workoutSession.findUnique.mockResolvedValue(session);
      prisma.setLog.update.mockResolvedValue({});

      await service.updateSet(userId, session.id, 'set-1', { completed: false });

      expect(prisma.setLog.update).toHaveBeenCalledWith({
        where: { id: 'set-1' },
        data: expect.objectContaining({ completed: false, completedAt: null }),
      });
    });

    it('lanza NotFoundException si la serie no pertenece a la sesión', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession());

      await expect(
        service.updateSet(userId, 'session-1', 'set-missing', { completed: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('finishSession', () => {
    it('lanza ConflictException si la sesión ya no está en progreso', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession({ status: 'completed' }));

      await expect(service.finishSession(userId, 'session-1')).rejects.toThrow(ConflictException);
    });

    it('calcula el volumen total solo con series completadas', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession());
      prisma.setLog.findFirst.mockResolvedValue(null); // sin historial previo
      prisma.workoutSession.update.mockResolvedValue(makeSession({ status: 'completed' }));

      const result = await service.finishSession(userId, 'session-1');

      // Solo set-1 (40kg x 10) está completed:true en el fixture -> 400kg
      expect(result.totalVolumeKg).toBe(400);
      expect(result.totalSets).toBe(2);
      expect(result.completedSets).toBe(1);
    });

    it('detecta un PR cuando el mejor peso de la sesión supera el histórico previo', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession());
      // getBestWeightForExercise (excluyendo esta sesión) devuelve un histórico menor
      prisma.setLog.findFirst.mockResolvedValue({ weightKg: 35 });
      prisma.workoutSession.update.mockResolvedValue(makeSession({ status: 'completed' }));

      const result = await service.finishSession(userId, 'session-1');

      expect(result.personalRecords).toEqual([
        { exerciseName: exercise.name, weightKg: 40 },
      ]);
    });

    it('no reporta un PR cuando el histórico previo ya era igual o mayor', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(makeSession());
      prisma.setLog.findFirst.mockResolvedValue({ weightKg: 40 });
      prisma.workoutSession.update.mockResolvedValue(makeSession({ status: 'completed' }));

      const result = await service.finishSession(userId, 'session-1');

      expect(result.personalRecords).toEqual([]);
    });

    it('no reporta un PR para un ejercicio sin ninguna serie completada', async () => {
      const session = makeSession({
        exercises: [
          {
            id: 'session-ex-1',
            exerciseId: exercise.id,
            exercise,
            sets: [{ id: 'set-1', setNumber: 1, weightKg: 40, reps: 10, completed: false, completedAt: null }],
          },
        ],
      });
      prisma.workoutSession.findUnique.mockResolvedValue(session);
      prisma.workoutSession.update.mockResolvedValue(session);

      const result = await service.finishSession(userId, 'session-1');

      expect(result.personalRecords).toEqual([]);
      expect(prisma.setLog.findFirst).not.toHaveBeenCalled();
    });
  });
});
