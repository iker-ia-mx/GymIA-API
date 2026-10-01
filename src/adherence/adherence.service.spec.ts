import type { Mock } from 'vitest';
import { AdherenceService } from './adherence.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function utc(y: number, m: number, d: number, h = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h));
}

describe('AdherenceService', () => {
  let service: AdherenceService;
  let prisma: {
    onboardingProfile: { findUnique: Mock };
    workoutSession: { findMany: Mock };
  };

  const userId = 'user-1';

  beforeEach(() => {
    prisma = {
      onboardingProfile: { findUnique: vi.fn() },
      workoutSession: { findMany: vi.fn() },
    };
    service = new AdherenceService(prisma as unknown as PrismaService);
    vi.useFakeTimers();
    vi.setSystemTime(utc(2026, 9, 25, 12)); // viernes 25 sep 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAdherence', () => {
    it('devuelve percentage null sin OnboardingProfile', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(null);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 10) });

      expect(result).toEqual({
        percentage: null,
        plannedDays: 0,
        completedDays: 0,
        windowStart: utc(2026, 9, 1),
        windowEnd: utc(2026, 9, 10),
      });
      expect(prisma.workoutSession.findMany).not.toHaveBeenCalled();
    });

    it('devuelve percentage null con trainingDays vacío', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: [], timezone: 'America/Mexico_City' });

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 10) });

      expect(result.percentage).toBeNull();
    });

    it('calcula el porcentaje correctamente (días planeados L/X/V, algunos cumplidos)', async () => {
      // Ventana 1-10 sep 2026: planeados (L=lun, X=mié, V=vie) = 2(mié), 4(vie), 7(lun), 9(mié) → 4 días
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L', 'X', 'V'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: utc(2026, 9, 2, 10) },
        { finishedAt: utc(2026, 9, 7, 10) },
      ]);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 10) });

      expect(result.plannedDays).toBe(4);
      expect(result.completedDays).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it('una sesión completada fuera de los días planeados no suma ni resta', async () => {
      // Solo lunes como día planeado. Ventana 1-8 sep: lunes 7 sep → 1 día planeado.
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: utc(2026, 9, 7, 10) }, // lunes planeado, cumplido
        { finishedAt: utc(2026, 9, 8, 10) }, // martes, fuera del plan
      ]);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 8) });

      expect(result.plannedDays).toBe(1);
      expect(result.completedDays).toBe(1);
      expect(result.percentage).toBe(100);
    });

    it('varias sesiones el mismo día cuentan como un solo día cumplido', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: utc(2026, 9, 7, 8) },
        { finishedAt: utc(2026, 9, 7, 18) },
      ]);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 8) });

      expect(result.plannedDays).toBe(1);
      expect(result.completedDays).toBe(1);
    });

    it('no cuenta días futuros de la ventana (hoy = 25 sep, ventana hasta 30 sep)', async () => {
      // L/X/V dentro de 1-30 sep, pero solo hasta el 25 (hoy) deben contar:
      // 2,4,7,9,11,14,16,18,21,23,25 = 11 planeados hasta hoy (28,30 sep quedan excluidos)
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L', 'X', 'V'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([]);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 30) });

      expect(result.plannedDays).toBe(11);
      // Rango con 1 día de margen a cada lado (no exacto a medianoche UTC) —
      // el bucketeo preciso por huso horario ocurre después en JS, ver
      // adherence.service.ts. Evita excluir sesiones cuyo día LOCAL cae en
      // la ventana pero cuyo instante UTC cae justo fuera.
      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            finishedAt: { gte: utc(2026, 8, 31), lte: utc(2026, 9, 26) },
          }),
        }),
      );
    });

    it('una sesión a las 23:00 hora de México cuenta para ese día local aunque ya sea otro día en UTC (bug corregido, 01.02 Auditoría backend)', async () => {
      // Lunes 7 sep, 23:00 hora de México (UTC-6) = martes 8 sep, 05:00 UTC.
      // Antes del fix, dayKey() leía la fecha UTC y la sesión se perdía como
      // "martes" (no planeado) en vez de contar para "lunes" (sí planeado).
      prisma.onboardingProfile.findUnique.mockResolvedValue({
        trainingDays: ['L'],
        timezone: 'America/Mexico_City',
      });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: new Date(Date.UTC(2026, 8, 8, 5, 0)) }, // martes 05:00 UTC = lunes 23:00 CDMX
      ]);

      const result = await service.getAdherence(userId, { start: utc(2026, 9, 1), end: utc(2026, 9, 8) });

      expect(result.plannedDays).toBe(1); // solo el lunes 7 sep
      expect(result.completedDays).toBe(1); // la sesión sí cuenta para el lunes
      expect(result.percentage).toBe(100);
    });

    it('con una ventana totalmente futura devuelve percentage null (sin días transcurridos)', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L'], timezone: 'America/Mexico_City' });

      const result = await service.getAdherence(userId, { start: utc(2026, 10, 1), end: utc(2026, 10, 31) });

      expect(result.percentage).toBeNull();
      expect(result.plannedDays).toBe(0);
    });

    it('usa el mes calendario actual como ventana por defecto', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: [], timezone: 'America/Mexico_City' });

      const result = await service.getAdherence(userId);

      expect(result.windowStart).toEqual(utc(2026, 9, 1));
      expect(result.windowEnd).toEqual(utc(2026, 9, 30));
    });
  });

  describe('getCurrentStreak', () => {
    it('devuelve 0 sin OnboardingProfile', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(null);

      const result = await service.getCurrentStreak(userId);

      expect(result).toBe(0);
      expect(prisma.workoutSession.findMany).not.toHaveBeenCalled();
    });

    it('cuenta días planeados consecutivos cumplidos hacia atrás, incluyendo hoy', async () => {
      // trainingDays L/X/V. Hoy = vie 25 sep (cumplido). Retrocede: mié 23 (cumplido), lun 21 (cumplido), vie 18 (NO cumplido) → racha = 3.
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L', 'X', 'V'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: utc(2026, 9, 25, 9) },
        { finishedAt: utc(2026, 9, 23, 9) },
        { finishedAt: utc(2026, 9, 21, 9) },
      ]);

      const result = await service.getCurrentStreak(userId);

      expect(result).toBe(3);
    });

    it('el día de hoy sin completar todavía no rompe la racha (pero tampoco suma)', async () => {
      // Hoy (vie 25) sin sesión. mié 23 y lun 21 cumplidos. vie 18 no cumplido → racha = 2.
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L', 'X', 'V'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { finishedAt: utc(2026, 9, 23, 9) },
        { finishedAt: utc(2026, 9, 21, 9) },
      ]);

      const result = await service.getCurrentStreak(userId);

      expect(result).toBe(2);
    });

    it('un día planeado pasado incumplido rompe la racha', async () => {
      // Hoy (vie 25) cumplido. mié 23 NO cumplido → racha = 1.
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: ['L', 'X', 'V'], timezone: 'America/Mexico_City' });
      prisma.workoutSession.findMany.mockResolvedValue([{ finishedAt: utc(2026, 9, 25, 9) }]);

      const result = await service.getCurrentStreak(userId);

      expect(result).toBe(1);
    });

    it('con trainingDays vacío devuelve 0', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({ trainingDays: [], timezone: 'America/Mexico_City' });

      const result = await service.getCurrentStreak(userId);

      expect(result).toBe(0);
    });
  });
});
