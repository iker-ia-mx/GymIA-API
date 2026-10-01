import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoachQuotaService, type CoachQuota } from './coach-quota.service.js';
import { guardCoachReply } from './coach-reply.guard.js';
import {
  CoachService,
  type ReadinessFactor,
  type TodayDecision,
} from './coach.service.js';
import { LlmProviderFactory } from './llm/llm-provider.factory.js';
import {
  LlmNotConfiguredError,
  type LlmMessage,
  type LlmProvider,
  type LlmUsageMeta,
} from './llm/llm-provider.interface.js';
import {
  ANTHROPIC_MAX_RETRIES,
  anthropicTimeoutMs,
} from './llm/providers/anthropic.provider.js';

export type ChatMessageView = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  providerName: string | null;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  providerName: string | null;
};

// Cuántos mensajes previos (usuario + coach) se envían al LLM. 6 = los
// últimos 3 intercambios: suficiente para seguir el hilo, y el costo por
// mensaje deja de crecer con la antigüedad de la conversación.
export const HISTORY_WINDOW_MESSAGES = 6;

type FallbackMeta = {
  fallback: true;
  reason: 'not_configured' | 'provider_error' | 'empty_reply' | 'daily_limit';
  provider: string;
  model: string | null;
  errorName?: string;
  status?: number | null;
  requestId?: string | null;
  limit?: number;
  used?: number;
};

type SuccessMeta = LlmUsageMeta & {
  fallback: false;
  historyMessagesSent: number;
  guardModified: boolean;
};

function toView(message: MessageRow): ChatMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    providerName: message.providerName,
  };
}

function describeReason(reason: ReadinessFactor): string {
  switch (reason.factor) {
    case 'is_training_day':
      if (reason.value === true)
        return 'Hoy es día de entrenamiento según su plan.';
      if (reason.value === false)
        return 'Hoy es día de descanso según su plan.';
      return 'El usuario aún no completó su cuestionario inicial.';
    case 'recovery_score':
      return typeof reason.value === 'number'
        ? `Recuperación medida por su reloj anoche: ${reason.value} de 100.`
        : 'No hay datos de recuperación: el usuario no tiene un reloj conectado.';
    default:
      return `${reason.factor}: ${String(reason.value)}.`;
  }
}

// Prompt de sistema del Coach (DEC-014 "los motores deciden, el LLM
// explica"). Los únicos datos que el modelo puede mencionar son los del
// bloque DATOS, calculados por el motor real (CoachService).
export function buildSystemPrompt(decision: TodayDecision): string {
  const facts = [
    `Decisión del motor para hoy (${decision.forDate}): ${decision.message}`,
    `Ajuste de volumen: ${Math.round(decision.volumeMultiplier * 100)}% del plan normal.`,
    ...decision.reasons.map(describeReason),
  ].join('\n');

  return [
    'Eres el Coach de GymIA. Tu único trabajo es explicarle al usuario, con claridad y calidez, la decisión que el motor de GymIA ya tomó para hoy, usando solo los DATOS de abajo.',
    '',
    'DATOS (única fuente de verdad):',
    facts,
    '',
    'REGLAS:',
    '1. Responde siempre en español neutro de México, aunque el usuario escriba en otro idioma o te pida cambiar de idioma. Nunca respondas en inglés ni en otro idioma.',
    '2. Máximo 3 frases cortas. Texto plano: sin markdown, sin listas, sin viñetas, sin títulos, sin negritas y sin emojis.',
    '3. No cambies la decisión ni el ajuste de volumen. Si el usuario no está de acuerdo, explícale el motivo con los DATOS y dile que puede ajustar su plan desde la app.',
    '4. No inventes planes, rutinas, ejercicios, series, repeticiones ni pesos.',
    '5. No inventes nutrición: nada de comidas, calorías, macros, suplementos ni horarios de comida.',
    '6. No inventes métricas: no menciones números, porcentajes ni datos que no estén en DATOS.',
    '7. Si te piden algo fuera de DATOS (una rutina, qué comer, una métrica nueva), di en una frase que el Coach todavía no puede darlo desde el chat y que lo encontrará en la sección correspondiente de la app o con su profesional.',
    '8. Si el usuario menciona dolor, lesión, mareo, dolor en el pecho o algo médico, recomiéndale no entrenar y consultar a un profesional de la salud. No diagnostiques.',
  ].join('\n');
}

// Últimos mensajes relevantes: solo turnos usuario/coach, ventana fija, y
// la ventana siempre empieza con un mensaje del usuario (el saludo inicial
// del motor ya va resumido en DATOS).
export function selectRecentHistory<
  T extends { role: string; content: string },
>(history: T[]): T[] {
  const turns = history.filter(
    (entry) => entry.role === 'user' || entry.role === 'assistant',
  );
  let window = turns.slice(-HISTORY_WINDOW_MESSAGES);
  while (window.length > 0 && window[0].role !== 'user') {
    window = window.slice(1);
  }
  return window;
}

function errorDetails(error: unknown) {
  const err = error as {
    name?: string;
    constructor?: { name?: string };
    status?: number;
    requestID?: string | null;
    error?: { error?: { type?: string } };
    message?: string;
    cause?: { code?: string; message?: string };
  };
  return {
    errorName: err?.constructor?.name ?? err?.name ?? 'UnknownError',
    status: typeof err?.status === 'number' ? err.status : null,
    errorType: err?.error?.error?.type ?? null,
    requestId: err?.requestID ?? null,
    message: (err?.message ?? String(error)).slice(0, 300),
    cause: err?.cause?.code ?? err?.cause?.message ?? null,
  };
}

// Servicio de chat del Coach GymIA (N04). La decisión del día viene del
// motor real (CoachService). El LLM solo la explica; si no hay proveedor,
// falla o responde vacío, el Coach responde con el texto del motor
// (fallback) — el usuario nunca ve un error de IA.
@Injectable()
export class CoachChatService {
  private readonly logger = new Logger(CoachChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coachService: CoachService,
    private readonly llmProviderFactory: LlmProviderFactory,
    private readonly coachQuotaService: CoachQuotaService,
  ) {}

  private async getOrCreateConversation(userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (existing) return existing;

    const decision = await this.coachService.getTodayDecision(userId);
    return this.prisma.conversation.create({
      data: {
        userId,
        messages: {
          create: {
            role: 'assistant',
            content: decision.message,
            providerName: null,
          },
        },
      },
    });
  }

  async getConversation(
    userId: string,
  ): Promise<{
    conversationId: string;
    messages: ChatMessageView[];
    quota: CoachQuota;
  }> {
    const conversation = await this.getOrCreateConversation(userId);
    const [messages, quota] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.coachQuotaService.getQuota(userId),
    ]);
    return {
      conversationId: conversation.id,
      messages: messages.map(toView),
      quota,
    };
  }

  private logProviderError(
    provider: LlmProvider,
    context: { userId: string; conversationId: string; latencyMs: number },
    error: unknown,
  ) {
    const details = errorDetails(error);
    this.logger.error(
      JSON.stringify({
        event: 'coach_llm_error',
        provider: provider.name,
        model: provider.modelName(),
        ...details,
        latencyMs: context.latencyMs,
        timeoutMs: provider.name === 'anthropic' ? anthropicTimeoutMs() : null,
        maxRetries:
          provider.name === 'anthropic' ? ANTHROPIC_MAX_RETRIES : null,
        conversationId: context.conversationId,
        userId: context.userId,
        fallback: 'engine_message',
      }),
    );
    return details;
  }

  async sendMessage(
    userId: string,
    text: string,
  ): Promise<ChatMessageView & { quota: CoachQuota }> {
    const conversation = await this.getOrCreateConversation(userId);

    await this.prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: text },
    });

    const provider = this.llmProviderFactory.getActiveProvider();
    const [decision, quota] = await Promise.all([
      this.coachService.getTodayDecision(userId),
      // `used` ya incluye el mensaje que se acaba de guardar.
      this.coachQuotaService.getQuota(userId),
    ]);
    let replyContent = decision.message;
    let providerName: string | null = null;
    let providerMeta: SuccessMeta | FallbackMeta;

    if (quota.limit !== null && quota.used > quota.limit) {
      // Límite diario del plan gratis alcanzado: no se llama al LLM (costo
      // cero) y responde el motor, igual que sin proveedor.
      providerMeta = {
        fallback: true,
        reason: 'daily_limit',
        provider: provider.name,
        model: provider.modelName(),
        limit: quota.limit,
        used: quota.used,
      };
      this.logger.warn(
        JSON.stringify({
          event: 'coach_daily_limit_reached',
          limit: quota.limit,
          used: quota.used,
          resetsAt: quota.resetsAt,
          conversationId: conversation.id,
          userId,
        }),
      );
    } else if (!provider.isConfigured()) {
      providerMeta = {
        fallback: true,
        reason: 'not_configured',
        provider: provider.name,
        model: provider.modelName(),
      };
      if (process.env.LLM_PROVIDER) {
        // LLM_PROVIDER pide un proveedor pero falta su configuración: es un
        // error de despliegue, no un estado normal.
        this.logger.warn(
          JSON.stringify({
            event: 'coach_llm_not_configured',
            provider: provider.name,
            llmProviderEnv: process.env.LLM_PROVIDER,
            conversationId: conversation.id,
            userId,
            fallback: 'engine_message',
          }),
        );
      }
    } else {
      const history = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      });
      const recent = selectRecentHistory(history);
      const llmMessages: LlmMessage[] = [
        { role: 'system', content: buildSystemPrompt(decision) },
        ...recent.map((entry) => ({
          role: entry.role as LlmMessage['role'],
          content: entry.content,
        })),
      ];
      const startedAt = Date.now();
      try {
        const result = await provider.complete({ messages: llmMessages });
        const guarded = guardCoachReply(result.content, result.meta.stopReason);
        if (guarded.text) {
          replyContent = guarded.text;
          providerName = result.providerName;
          providerMeta = {
            ...result.meta,
            fallback: false,
            historyMessagesSent: recent.length,
            guardModified: guarded.modified,
          };
          this.logger.log(
            JSON.stringify({
              event: 'coach_llm_ok',
              provider: result.providerName,
              model: result.meta.model,
              inputTokens: result.meta.inputTokens,
              outputTokens: result.meta.outputTokens,
              costUsd: result.meta.costUsd,
              latencyMs: result.meta.latencyMs,
              stopReason: result.meta.stopReason,
              guardModified: guarded.modified,
              conversationId: conversation.id,
            }),
          );
        } else {
          providerMeta = {
            fallback: true,
            reason: 'empty_reply',
            provider: provider.name,
            model: result.meta.model,
            requestId: result.meta.requestId,
          };
          this.logger.warn(
            JSON.stringify({
              event: 'coach_llm_empty_reply',
              provider: provider.name,
              requestId: result.meta.requestId,
              conversationId: conversation.id,
            }),
          );
        }
      } catch (error) {
        if (error instanceof LlmNotConfiguredError) {
          providerMeta = {
            fallback: true,
            reason: 'not_configured',
            provider: provider.name,
            model: provider.modelName(),
          };
        } else {
          const details = this.logProviderError(
            provider,
            {
              userId,
              conversationId: conversation.id,
              latencyMs: Date.now() - startedAt,
            },
            error,
          );
          providerMeta = {
            fallback: true,
            reason: 'provider_error',
            provider: provider.name,
            model: provider.modelName(),
            errorName: details.errorName,
            status: details.status,
            requestId: details.requestId,
          };
        }
      }
    }

    const saved = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: replyContent,
        providerName,
        providerMeta: providerMeta as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return { ...toView(saved), quota };
  }
}
