import type { Mock } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  CoachQuotaService,
  DEFAULT_FREE_DAILY_LIMIT,
  freeDailyLimit,
  localDayWindow,
} from './coach-quota.service.js';

describe('localDayWindow', () => {
  it('usa la medianoche de Ciudad de México (UTC-6), no la de UTC', () => {
    // 30 sep 2026 20:00 en CDMX = 1 oct 02:00 UTC → sigue siendo 30 sep local
    const { start, end } = localDayWindow(
      new Date('2026-10-01T02:00:00Z'),
      'America/Mexico_City',
    );
    expect(start.toISOString()).toBe('2026-09-30T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T06:00:00.000Z');
  });

  it('respeta el cambio de horario (Madrid, 25 oct 2026 dura 25 h)', () => {
    const { start, end } = localDayWindow(
      new Date('2026-10-25T12:00:00Z'),
      'Europe/Madrid',
    );
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('cae a America/Mexico_City con una zona inválida o vacía', () => {
    const now = new Date('2026-10-01T02:00:00Z');
    expect(localDayWindow(now, 'No/Existe')).toEqual(
      localDayWindow(now, 'America/Mexico_City'),
    );
    expect(localDayWindow(now, null)).toEqual(
      localDayWindow(now, 'America/Mexico_City'),
    );
  });
});

describe('freeDailyLimit', () => {
  afterEach(() => {
    delete process.env.COACH_FREE_DAILY_LIMIT;
  });

  it('es 5 por defecto', () => {
    expect(freeDailyLimit()).toBe(DEFAULT_FREE_DAILY_LIMIT);
    expect(DEFAULT_FREE_DAILY_LIMIT).toBe(5);
  });

  it('se puede ajustar con COACH_FREE_DAILY_LIMIT y ignora valores inválidos', () => {
    process.env.COACH_FREE_DAILY_LIMIT = '8';
    expect(freeDailyLimit()).toBe(8);
    process.env.COACH_FREE_DAILY_LIMIT = 'abc';
    expect(freeDailyLimit()).toBe(5);
    process.env.COACH_FREE_DAILY_LIMIT = '0';
    expect(freeDailyLimit()).toBe(5);
  });
});

describe('CoachQuotaService.getQuota', () => {
  let prisma: {
    onboardingProfile: { findUnique: Mock };
    message: { count: Mock };
    user: { findUnique: Mock };
  };
  let service: CoachQuotaService;
  const now = new Date('2026-10-01T02:00:00Z');

  beforeEach(() => {
    prisma = {
      onboardingProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ timezone: 'America/Mexico_City' }),
      },
      message: { count: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    service = new CoachQuotaService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    delete process.env.COACH_UNLIMITED_EMAILS;
  });

  it('cuenta solo mensajes del usuario de hoy en su zona horaria', async () => {
    prisma.message.count.mockResolvedValue(3);
    const quota = await service.getQuota('u1', now);
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: {
        role: 'user',
        createdAt: {
          gte: new Date('2026-09-30T06:00:00.000Z'),
          lt: new Date('2026-10-01T06:00:00.000Z'),
        },
        conversation: { userId: 'u1' },
      },
    });
    expect(quota).toEqual({
      unlimited: false,
      limit: 5,
      used: 3,
      remaining: 2,
      resetsAt: '2026-10-01T06:00:00.000Z',
    });
  });

  it('remaining nunca es negativo', async () => {
    prisma.message.count.mockResolvedValue(9);
    const quota = await service.getQuota('u1', now);
    expect(quota.remaining).toBe(0);
  });

  it('los correos de COACH_UNLIMITED_EMAILS no tienen límite', async () => {
    process.env.COACH_UNLIMITED_EMAILS = 'Tester@GymIA.mx, otro@gymia.mx';
    prisma.user.findUnique.mockResolvedValue({ email: 'tester@gymia.mx' });
    prisma.message.count.mockResolvedValue(40);
    const quota = await service.getQuota('u1', now);
    expect(quota).toMatchObject({
      unlimited: true,
      limit: null,
      remaining: null,
      used: 40,
    });
  });

  it('sin allowlist no consulta el correo del usuario', async () => {
    prisma.message.count.mockResolvedValue(0);
    await service.getQuota('u1', now);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
