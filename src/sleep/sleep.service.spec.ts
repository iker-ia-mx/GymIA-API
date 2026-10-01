import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { SleepService } from './sleep.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('SleepService', () => {
  let service: SleepService;
  let prisma: {
    sleepSession: { create: Mock; findMany: Mock; findFirst: Mock; findUnique: Mock; delete: Mock };
    sleepDataSource: { findMany: Mock; upsert: Mock; findUnique: Mock; update: Mock };
  };

  const userId = 'user-1';
  const otherUserId = 'user-2';

  beforeEach(() => {
    prisma = {
      sleepSession: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
      sleepDataSource: { findMany: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    };
    service = new SleepService(prisma as unknown as PrismaService);
  });

  describe('importSession', () => {
    it('asocia la sesión al usuario autenticado y guarda la fuente', async () => {
      prisma.sleepSession.create.mockResolvedValue({});

      await service.importSession(userId, {
        startedAt: '2026-09-24T23:00:00.000Z',
        endedAt: '2026-09-25T06:45:00.000Z',
        timeInBedMinutes: 465,
        sleepEfficiencyPct: 88,
        source: 'apple_health',
      });

      expect(prisma.sleepSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, source: 'apple_health', timeInBedMinutes: 465 }),
        }),
      );
    });

    it('crea las fases de sueño anidadas cuando se envían', async () => {
      prisma.sleepSession.create.mockResolvedValue({});

      await service.importSession(userId, {
        startedAt: '2026-09-24T23:00:00.000Z',
        source: 'apple_health',
        stages: [{ stage: 'profundo', startedAt: '2026-09-24T23:30:00.000Z' }],
      });

      expect(prisma.sleepSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stages: { create: [expect.objectContaining({ stage: 'profundo' })] },
          }),
        }),
      );
    });
  });

  describe('getSessionById', () => {
    it('lanza NotFoundException si no existe', async () => {
      prisma.sleepSession.findUnique.mockResolvedValue(null);

      await expect(service.getSessionById(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la sesión pertenece a otro usuario', async () => {
      prisma.sleepSession.findUnique.mockResolvedValue({ id: 's1', userId, stages: [] });

      await expect(service.getSessionById(otherUserId, 's1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('connectSource', () => {
    it('marca la fuente como "conectado" cuando al menos un permiso fue concedido', async () => {
      prisma.sleepDataSource.upsert.mockResolvedValue({});

      await service.connectSource(userId, 'apple_health', { grantsSleepAnalysis: true });

      expect(prisma.sleepDataSource.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_provider: { userId, provider: 'apple_health' } },
          create: expect.objectContaining({ status: 'conectado', grantsSleepAnalysis: true }),
        }),
      );
    });

    it('marca la fuente como "requiere_permiso" cuando no se concedió nada', async () => {
      prisma.sleepDataSource.upsert.mockResolvedValue({});

      await service.connectSource(userId, 'apple_health', {});

      expect(prisma.sleepDataSource.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'requiere_permiso' }),
        }),
      );
    });
  });

  describe('disconnectSource', () => {
    it('lanza NotFoundException si la fuente no existe', async () => {
      prisma.sleepDataSource.findUnique.mockResolvedValue(null);

      await expect(service.disconnectSource(userId, 'apple_health')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resyncSource', () => {
    it('lanza ConflictException si la fuente no está conectada', async () => {
      prisma.sleepDataSource.findUnique.mockResolvedValue({
        userId,
        provider: 'apple_health',
        status: 'requiere_permiso',
      });

      await expect(service.resyncSource(userId, 'apple_health')).rejects.toThrow(ConflictException);
    });

    it('actualiza lastSyncedAt cuando la fuente está conectada', async () => {
      prisma.sleepDataSource.findUnique.mockResolvedValue({
        userId,
        provider: 'apple_health',
        status: 'conectado',
      });
      prisma.sleepDataSource.update.mockResolvedValue({});

      await service.resyncSource(userId, 'apple_health');

      expect(prisma.sleepDataSource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_provider: { userId, provider: 'apple_health' } },
          data: expect.objectContaining({ lastSyncedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
