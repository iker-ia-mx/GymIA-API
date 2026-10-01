import { Injectable } from '@nestjs/common';
import {
  AdherenceService,
  DAY_CODE_TO_WEEKDAY,
} from '../adherence/adherence.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Motor del Coach GymIA v0 (04.01 GymIA Brain · Arquitectura IA, vault
// Master Brain V2 — DEC-014 "los motores deciden, el LLM explica").
// Todo aquí es determinista sobre datos reales; no hay modelo de IA ni
// texto generado por un LLM todavía. Cuando un factor real no existe
// (p. ej. sin datos de sueño de un wearable conectado), se declara
// explícitamente en `reasons` en vez de inventarse — "no simular" es la
// misma regla que ya sigue el resto de la app (HealthKit, Sueño, Perfil).
const ENGINE_VERSION = '0.1.0';

export type ReadinessFactor = {
  factor: string;
  value: number | string | boolean;
};

export type ReadinessResult = {
  available: boolean;
  score: number | null;
  asOf: string | null;
  reasons: ReadinessFactor[];
};

export type TodayDecision = {
  engine: 'coach_today';
  engineVersion: string;
  forDate: string;
  isTrainingDay: boolean | null;
  volumeMultiplier: number;
  message: string;
  reasons: ReadinessFactor[];
};

export type WeeklyReview = {
  engine: 'coach_weekly_review';
  engineVersion: string;
  windowStart: string;
  windowEnd: string;
  sessionsCompleted: number;
  adherencePercentage: number | null;
  averageRecoveryScorePct: number | null;
  reasons: ReadinessFactor[];
};

const DEFAULT_TIMEZONE = 'America/Mexico_City';

// Fecha de hoy en la zona horaria del usuario (OnboardingProfile.timezone).
// Antes se usaba UTC: en México, de 18:00 a 23:59 el Coach ya creía que era
// el día siguiente y podía cambiar día de entreno por día de descanso.
function localToday(timezone: string): { forDate: Date; weekday: number } {
  let key: string;
  try {
    key = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    key = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  const forDate = new Date(`${key}T00:00:00.000Z`);
  return { forDate, weekday: forDate.getUTCDay() };
}

function dayCodeFor(weekday: number): string {
  const entry = Object.entries(DAY_CODE_TO_WEEKDAY).find(
    ([, value]) => value === weekday,
  );
  return entry?.[0] ?? 'D';
}

@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adherenceService: AdherenceService,
  ) {}

  // Preparación del día (Readiness Engine v0, 04.02 Catálogo de motores
  // IA). Única fuente real disponible hoy: `SleepSession.recoveryScorePct`
  // importado de un wearable. Sin conexión real (HealthKit/Health Connect
  // siguen en stub), no hay dato — se declara `available: false`, nunca
  // se inventa un número.
  async getReadiness(userId: string): Promise<ReadinessResult> {
    const latest = await this.prisma.sleepSession.findFirst({
      where: { userId, recoveryScorePct: { not: null } },
      orderBy: { startedAt: 'desc' },
    });

    if (!latest || latest.recoveryScorePct === null) {
      return {
        available: false,
        score: null,
        asOf: null,
        reasons: [{ factor: 'recovery_score', value: 'no_wearable_data' }],
      };
    }

    return {
      available: true,
      score: latest.recoveryScorePct,
      asOf: latest.startedAt.toISOString(),
      reasons: [{ factor: 'recovery_score', value: latest.recoveryScorePct }],
    };
  }

  // Decisión del día (Orquestador, 04.01). Combina: (1) si hoy es día de
  // entreno planeado (OnboardingProfile.trainingDays, mismo dato que ya
  // usa el Motor de Adherencia), y (2) la preparación real del día si
  // existe. El volumen solo se ajusta cuando hay una razón real medida —
  // sin datos de recuperación, el multiplicador se queda en 1 (sin ajuste
  // fabricado). Persiste la decisión en `AIDecision` (libro mayor).
  async getTodayDecision(userId: string): Promise<TodayDecision> {
    const [profile, readiness] = await Promise.all([
      this.prisma.onboardingProfile.findUnique({ where: { userId } }),
      this.getReadiness(userId),
    ]);
    const { forDate, weekday } = localToday(
      profile?.timezone ?? DEFAULT_TIMEZONE,
    );

    const isTrainingDay = profile
      ? profile.trainingDays.includes(dayCodeFor(weekday))
      : null;

    let volumeMultiplier = 1;
    const reasons: ReadinessFactor[] = [
      {
        factor: 'is_training_day',
        value: isTrainingDay ?? 'no_onboarding_profile',
      },
      ...readiness.reasons,
    ];

    if (readiness.available && readiness.score !== null) {
      if (readiness.score < 40) {
        volumeMultiplier = 0.8;
      } else if (readiness.score < 70) {
        volumeMultiplier = 0.9;
      }
    }

    let message: string;
    if (isTrainingDay === null) {
      message =
        'Completa tu cuestionario inicial para que el Coach sepa qué días entrenas.';
    } else if (!isTrainingDay) {
      message =
        'Hoy es tu día de descanso planeado. Puedes entrenar igual si quieres adelantar.';
    } else if (volumeMultiplier < 1) {
      message = `Hoy toca entrenar. Ajustamos el volumen al ${Math.round(volumeMultiplier * 100)}% por tu recuperación de anoche.`;
    } else {
      message = 'Hoy toca entrenar, con tu plan normal.';
    }

    const decision: TodayDecision = {
      engine: 'coach_today',
      engineVersion: ENGINE_VERSION,
      forDate: forDate.toISOString().slice(0, 10),
      isTrainingDay,
      volumeMultiplier,
      message,
      reasons,
    };

    await this.prisma.aIDecision.upsert({
      where: {
        userId_engine_forDate: { userId, engine: 'coach_today', forDate },
      },
      create: {
        userId,
        engine: 'coach_today',
        engineVersion: ENGINE_VERSION,
        forDate,
        output: { isTrainingDay, volumeMultiplier, message },
        reasons,
      },
      update: {
        engineVersion: ENGINE_VERSION,
        output: { isTrainingDay, volumeMultiplier, message },
        reasons,
      },
    });

    return decision;
  }

  // Revisión semanal (N17 de GYMIA MASTER FLOW V1). Agregación real de los
  // últimos 7 días — sin resumen generado por LLM, solo los datos.
  async getWeeklyReview(userId: string): Promise<WeeklyReview> {
    const profile = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const windowEnd = localToday(profile?.timezone ?? DEFAULT_TIMEZONE).forDate;
    const windowStart = new Date(windowEnd);
    windowStart.setUTCDate(windowStart.getUTCDate() - 6);

    const [sessionsCompleted, adherence, sleepSessions] = await Promise.all([
      this.prisma.workoutSession.count({
        where: {
          userId,
          status: 'completed',
          finishedAt: { gte: windowStart },
        },
      }),
      this.adherenceService.getAdherence(userId, {
        start: windowStart,
        end: windowEnd,
      }),
      this.prisma.sleepSession.findMany({
        where: {
          userId,
          startedAt: { gte: windowStart },
          recoveryScorePct: { not: null },
        },
        select: { recoveryScorePct: true },
      }),
    ]);

    const recoveryScores = sleepSessions
      .map((entry) => entry.recoveryScorePct)
      .filter((value): value is number => value !== null);
    const averageRecoveryScorePct =
      recoveryScores.length > 0
        ? Math.round(
            recoveryScores.reduce((sum, value) => sum + value, 0) /
              recoveryScores.length,
          )
        : null;

    const review: WeeklyReview = {
      engine: 'coach_weekly_review',
      engineVersion: ENGINE_VERSION,
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
      sessionsCompleted,
      adherencePercentage: adherence.percentage,
      averageRecoveryScorePct,
      reasons: [
        { factor: 'sessions_completed', value: sessionsCompleted },
        {
          factor: 'adherence_percentage',
          value: adherence.percentage ?? 'no_plan',
        },
        {
          factor: 'average_recovery_score',
          value: averageRecoveryScorePct ?? 'no_wearable_data',
        },
      ],
    };

    await this.prisma.aIDecision.upsert({
      where: {
        userId_engine_forDate: {
          userId,
          engine: 'coach_weekly_review',
          forDate: windowEnd,
        },
      },
      create: {
        userId,
        engine: 'coach_weekly_review',
        engineVersion: ENGINE_VERSION,
        forDate: windowEnd,
        output: {
          sessionsCompleted,
          adherencePercentage: adherence.percentage,
          averageRecoveryScorePct,
        },
        reasons: review.reasons,
      },
      update: {
        engineVersion: ENGINE_VERSION,
        output: {
          sessionsCompleted,
          adherencePercentage: adherence.percentage,
          averageRecoveryScorePct,
        },
        reasons: review.reasons,
      },
    });

    return review;
  }
}
