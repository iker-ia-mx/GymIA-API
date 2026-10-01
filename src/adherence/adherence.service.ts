import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Motor de Adherencia (docs/ADHERENCE_ENGINE_ARCHITECTURE.md). Única costura
// reutilizable por Evolución, Escuadrón y Achievements — ningún otro
// servicio debe reimplementar este cálculo. Se deriva por completo de datos
// que ya existen (OnboardingProfile.trainingDays + WorkoutSession):
// CERO modelos Prisma nuevos, CERO migraciones, CERO tablas auxiliares.
// Fórmula transparente y determinista — no es un modelo de IA, mismo
// principio ya usado por `progressScore` en EvolutionService.

// Mapeo de los códigos de OnboardingProfile.trainingDays (["L","M","X","J",
// "V","S","D"]) al día de la semana de Date.getUTCDay() (0=domingo).
export const DAY_CODE_TO_WEEKDAY: Record<string, number> = {
  D: 0,
  L: 1,
  M: 2,
  X: 3,
  J: 4,
  V: 5,
  S: 6,
};

// Tope de días hacia atrás al calcular la racha — evita un bucle sin límite
// para una cuenta muy antigua; 400 días cubre más de un año de historial,
// más que suficiente para cualquier racha realista.
const STREAK_LOOKBACK_DAYS = 400;

export type AdherenceWindow = { start: Date; end: Date };

export type AdherenceOverview = {
  percentage: number | null;
  plannedDays: number;
  completedDays: number;
  windowStart: Date;
  windowEnd: Date;
};

// `start`/`end`/los cursores del bucle de días representan FECHAS DE
// CALENDARIO abstractas (medianoche UTC usada como marcador), no
// instantes reales — por eso su día de la semana y su `dayKey` se leen
// directamente en UTC sin conversión. Lo que sí es un instante real es
// `WorkoutSession.finishedAt`; ESE es el que hay que convertir a la fecha
// de calendario del huso horario del usuario con `dayKeyInTimezone` antes
// de comparar. Mezclar ambos sin distinguirlos fue exactamente el bug ya
// señalado en 01.02 Auditoría backend ("adherencia cuenta los días
// entrenados como fallidos… todo hoy/semana en UTC").
function startOfUtcDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Fecha de calendario (YYYY-MM-DD) que un instante real representa en un
// huso horario dado — para bucketear `finishedAt` por el día local del
// usuario, no por el día UTC en el que la sesión se guardó.
function dayKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// La fecha de calendario "de hoy" en el huso horario del usuario,
// representada como el mismo marcador UTC-medianoche que usan `start`/
// `end`/los cursores — así puede compararse con ellos directamente.
function todayAsCalendarDate(timezone: string): Date {
  const [year, month, day] = dayKeyInTimezone(new Date(), timezone).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Los filtros de la consulta a Prisma comparan `finishedAt` (instante
// real) contra estos marcadores (fechas de calendario en UTC-medianoche)
// — un margen de 1 día de cada lado evita excluir sesiones cuyo día LOCAL
// cae dentro de la ventana pero cuyo instante UTC cae justo fuera (p. ej.
// una sesión a las 23:00 en México, ~05:00 UTC del día siguiente). El
// bucketeo preciso por huso horario ocurre después, en JS — el margen
// solo evita falsos negativos en la consulta a la base de datos.
function padDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getCurrentMonthWindow(timezone: string): AdherenceWindow {
  const today = todayAsCalendarDate(timezone);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { start, end };
}

@Injectable()
export class AdherenceService {
  constructor(private readonly prisma: PrismaService) {}

  // Adherencia = % de los días de entrenamiento que el propio usuario
  // declaró (OnboardingProfile.trainingDays) en los que efectivamente
  // completó una WorkoutSession, dentro de `window` (mes calendario actual
  // por defecto). Los días futuros de la ventana nunca cuentan como
  // incumplidos — solo se evalúan días ya transcurridos.
  async getAdherence(userId: string, window?: AdherenceWindow): Promise<AdherenceOverview> {
    const profile = await this.prisma.onboardingProfile.findUnique({ where: { userId } });

    if (!profile || profile.trainingDays.length === 0) {
      const fallback = window ?? getCurrentMonthWindow('America/Mexico_City');
      return {
        percentage: null,
        plannedDays: 0,
        completedDays: 0,
        windowStart: fallback.start,
        windowEnd: fallback.end,
      };
    }

    const timezone = profile.timezone;
    const { start, end } = window ?? getCurrentMonthWindow(timezone);
    const trainingWeekdays = new Set(profile.trainingDays.map((code) => DAY_CODE_TO_WEEKDAY[code]));
    const today = todayAsCalendarDate(timezone);
    const effectiveEnd = end.getTime() < today.getTime() ? end : today;

    const plannedDates: Date[] = [];
    for (
      let cursor = startOfUtcDay(start);
      cursor.getTime() <= effectiveEnd.getTime();
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      if (trainingWeekdays.has(cursor.getUTCDay())) {
        plannedDates.push(new Date(cursor));
      }
    }

    if (plannedDates.length === 0) {
      return { percentage: null, plannedDays: 0, completedDays: 0, windowStart: start, windowEnd: end };
    }

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'completed',
        finishedAt: { gte: padDays(start, -1), lte: padDays(effectiveEnd, 1) },
      },
      select: { finishedAt: true },
    });

    const completedDayKeys = new Set(
      sessions
        .filter((session): session is { finishedAt: Date } => session.finishedAt !== null)
        .map((session) => dayKeyInTimezone(session.finishedAt, timezone)),
    );

    const completedDays = plannedDates.filter((date) => completedDayKeys.has(dayKey(date))).length;

    return {
      percentage: Math.round((completedDays / plannedDates.length) * 100),
      plannedDays: plannedDates.length,
      completedDays,
      windowStart: start,
      windowEnd: end,
    };
  }

  // Racha actual: días de entrenamiento planeados consecutivos cumplidos,
  // contando hacia atrás desde hoy, sin romperse por el propio día de hoy
  // si todavía no tiene sesión (hoy puede completarse más tarde). Se
  // detiene en el primer día planeado pasado que se incumplió.
  async getCurrentStreak(userId: string): Promise<number> {
    const profile = await this.prisma.onboardingProfile.findUnique({ where: { userId } });
    if (!profile || profile.trainingDays.length === 0) {
      return 0;
    }

    const timezone = profile.timezone;
    const trainingWeekdays = new Set(profile.trainingDays.map((code) => DAY_CODE_TO_WEEKDAY[code]));
    const today = todayAsCalendarDate(timezone);
    const lookbackStart = new Date(today);
    lookbackStart.setUTCDate(lookbackStart.getUTCDate() - STREAK_LOOKBACK_DAYS);

    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId, status: 'completed', finishedAt: { gte: padDays(lookbackStart, -1) } },
      select: { finishedAt: true },
    });
    const completedDayKeys = new Set(
      sessions
        .filter((session): session is { finishedAt: Date } => session.finishedAt !== null)
        .map((session) => dayKeyInTimezone(session.finishedAt, timezone)),
    );

    let streak = 0;
    const cursor = new Date(today);
    for (let i = 0; i <= STREAK_LOOKBACK_DAYS; i++) {
      if (trainingWeekdays.has(cursor.getUTCDay())) {
        if (completedDayKeys.has(dayKey(cursor))) {
          streak += 1;
        } else if (cursor.getTime() !== today.getTime()) {
          break;
        }
        // Si es hoy y todavía no está completado, no rompe la racha ni suma —
        // simplemente se sigue retrocediendo a partir de ayer.
      }
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
  }
}
