import type { Mock } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CoachChatService } from './coach-chat.service.js';
import type { CoachQuota, CoachQuotaService } from './coach-quota.service.js';
import type { CoachService, TodayDecision } from './coach.service.js';
import type { LlmProviderFactory } from './llm/llm-provider.factory.js';
import type { LlmProvider } from './llm/llm-provider.interface.js';

const decision: TodayDecision = {
  engine: 'coach_today',
  engineVersion: '0.1.0',
  forDate: '2026-09-30',
  isTrainingDay: true,
  volumeMultiplier: 0.9,
  message:
    'Hoy toca entrenar. Ajustamos el volumen al 90% por tu recuperación de anoche.',
  reasons: [
    { factor: 'is_training_day', value: true },
    { factor: 'recovery_score', value: 58 },
  ],
};

function quota(used: number, limit: number | null = 5): CoachQuota {
  return {
    unlimited: limit === null,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: '2026-10-01T06:00:00.000Z',
  };
}

describe('CoachChatService.sendMessage · límite diario', () => {
  let prisma: {
    conversation: { findFirst: Mock; create: Mock; update: Mock };
    message: { create: Mock; findMany: Mock };
  };
  let provider: {
    name: string;
    isConfigured: Mock;
    modelName: Mock;
    complete: Mock;
  };
  let quotaService: { getQuota: Mock };
  let service: CoachChatService;

  beforeEach(() => {
    prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', userId: 'u1' }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      message: {
        create: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({
              id: `m-${data.role}`,
              createdAt: new Date('2026-09-30T20:00:00Z'),
              providerName: null,
              ...data,
            }),
          ),
        findMany: vi
          .fn()
          .mockResolvedValue([{ role: 'user', content: 'hola' }]),
      },
    };
    provider = {
      name: 'anthropic',
      isConfigured: vi.fn().mockReturnValue(true),
      modelName: vi.fn().mockReturnValue('claude-haiku-4-5'),
      complete: vi.fn().mockResolvedValue({
        content: 'Hoy sí entrenas, al 90% por tu recuperación de 58 de 100.',
        providerName: 'anthropic',
        meta: {
          model: 'claude-haiku-4-5-20251001',
          requestedModel: 'claude-haiku-4-5',
          inputTokens: 600,
          outputTokens: 60,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          stopReason: 'end_turn',
          requestId: 'req_1',
          latencyMs: 900,
          costUsd: 0.0009,
          pricingVersion: '2026-09-30',
        },
      }),
    };
    quotaService = { getQuota: vi.fn() };
    const coachService = {
      getTodayDecision: vi.fn().mockResolvedValue(decision),
    };
    const factory = {
      getActiveProvider: () => provider as unknown as LlmProvider,
    };
    service = new CoachChatService(
      prisma as unknown as PrismaService,
      coachService as unknown as CoachService,
      factory as unknown as LlmProviderFactory,
      quotaService as unknown as CoachQuotaService,
    );
  });

  const savedAssistant = () =>
    prisma.message.create.mock.calls.at(-1)?.[0].data;

  it('mensaje 5 de 5: llama al LLM y guarda providerMeta con coste', async () => {
    quotaService.getQuota.mockResolvedValue(quota(5));
    const reply = await service.sendMessage('u1', '¿entreno hoy?');
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(reply.providerName).toBe('anthropic');
    expect(reply.quota.remaining).toBe(0);
    expect(savedAssistant().providerMeta).toMatchObject({
      fallback: false,
      costUsd: 0.0009,
      inputTokens: 600,
    });
  });

  it('mensaje 6 de 5: no llama al LLM y responde el motor con reason daily_limit', async () => {
    quotaService.getQuota.mockResolvedValue(quota(6));
    const reply = await service.sendMessage('u1', 'otra pregunta');
    expect(provider.complete).not.toHaveBeenCalled();
    expect(reply.content).toBe(decision.message);
    expect(reply.providerName).toBeNull();
    expect(savedAssistant()).toMatchObject({
      role: 'assistant',
      content: decision.message,
      providerName: null,
      providerMeta: {
        fallback: true,
        reason: 'daily_limit',
        limit: 5,
        used: 6,
      },
    });
  });

  it('el mensaje del usuario se guarda aunque se haya alcanzado el límite', async () => {
    quotaService.getQuota.mockResolvedValue(quota(6));
    await service.sendMessage('u1', 'otra pregunta');
    expect(prisma.message.create.mock.calls[0][0].data).toEqual({
      conversationId: 'c1',
      role: 'user',
      content: 'otra pregunta',
    });
  });

  it('usuario sin límite (allowlist): llama al LLM aunque lleve 40 mensajes', async () => {
    quotaService.getQuota.mockResolvedValue(quota(40, null));
    const reply = await service.sendMessage('u1', 'pregunta');
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(reply.providerName).toBe('anthropic');
  });

  it('bajo el límite, un error del proveedor sigue cayendo al motor (provider_error)', async () => {
    quotaService.getQuota.mockResolvedValue(quota(2));
    provider.complete.mockRejectedValue(
      Object.assign(new Error('boom'), { status: 529 }),
    );
    const reply = await service.sendMessage('u1', 'pregunta');
    expect(reply.content).toBe(decision.message);
    expect(savedAssistant().providerMeta).toMatchObject({
      fallback: true,
      reason: 'provider_error',
      status: 529,
    });
  });

  it('sin proveedor configurado y bajo el límite: not_configured', async () => {
    quotaService.getQuota.mockResolvedValue(quota(1));
    provider.isConfigured.mockReturnValue(false);
    await service.sendMessage('u1', 'pregunta');
    expect(provider.complete).not.toHaveBeenCalled();
    expect(savedAssistant().providerMeta).toMatchObject({
      fallback: true,
      reason: 'not_configured',
    });
  });
});
