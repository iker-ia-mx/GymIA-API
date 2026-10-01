import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Límite diario de mensajes del chat del Coach para usuarios gratuitos
// (Master Brain V2 · 08.03 Precios: "5 mensajes de Coach/día" en el plan
// gratis). Al llegar al límite el chat NO llama al LLM: responde con la
// decisión del motor (mismo respaldo que sin proveedor) y lo marca en
// `providerMeta.reason = 'daily_limit'`.
export const DEFAULT_FREE_DAILY_LIMIT = 5;
const DEFAULT_TIMEZONE = 'America/Mexico_City';

export type CoachQuota = {
  unlimited: boolean;
  limit: number | null; // null = sin límite (Premium o allowlist)
  used: number; // mensajes del usuario enviados hoy (hora local), incluido el actual si ya se guardó
  remaining: number | null;
  resetsAt: string; // medianoche local siguiente, ISO UTC
};

export function freeDailyLimit(): number {
  const fromEnv = Number(process.env.COACH_FREE_DAILY_LIMIT);
  return Number.isInteger(fromEnv) && fromEnv > 0
    ? fromEnv
    : DEFAULT_FREE_DAILY_LIMIT;
}

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    min: get('minute'),
    s: get('second'),
  };
}

function safeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// Instante UTC de la medianoche local del día de `now` (y de la siguiente)
// en `timezone`. Sin dependencias: calcula el desfase con Intl.
export function localDayWindow(
  now: Date,
  timezone: string | null | undefined,
): { start: Date; end: Date } {
  const tz = safeTimezone(timezone);
  const p = localParts(now, tz);
  const offsetMs = (at: number) => {
    const q = localParts(new Date(at), tz);
    return (
      Date.UTC(q.y, q.m - 1, q.d, q.h, q.min, q.s) -
      Math.floor(at / 1000) * 1000
    );
  };
  const midnightAsUtc = Date.UTC(p.y, p.m - 1, p.d);
  const start = midnightAsUtc - offsetMs(midnightAsUtc);
  const nextAsUtc = Date.UTC(p.y, p.m - 1, p.d + 1);
  const end = nextAsUtc - offsetMs(nextAsUtc);
  return { start: new Date(start), end: new Date(end) };
}

@Injectable()
export class CoachQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  // No existe todavía un modelo de suscripción (08.02 · billing pendiente):
  // hoy todos los usuarios son gratuitos salvo los correos de
  // COACH_UNLIMITED_EMAILS (equipo interno y testers de la beta).
  async isUnlimited(userId: string): Promise<boolean> {
    const allowlist = (process.env.COACH_UNLIMITED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.length === 0) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return !!user && allowlist.includes(user.email.toLowerCase());
  }

  async getQuota(userId: string, now: Date = new Date()): Promise<CoachQuota> {
    const profile = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const { start, end } = localDayWindow(now, profile?.timezone);
    const [unlimited, used] = await Promise.all([
      this.isUnlimited(userId),
      this.prisma.message.count({
        where: {
          role: 'user',
          createdAt: { gte: start, lt: end },
          conversation: { userId },
        },
      }),
    ]);
    const limit = unlimited ? null : freeDailyLimit();
    return {
      unlimited,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      resetsAt: end.toISOString(),
    };
  }
}
