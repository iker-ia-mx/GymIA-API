import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import {
  LlmNotConfiguredError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../llm-provider.interface.js';
import { PRICING_VERSION, estimateCostUsd } from '../pricing.js';

// DEC-014: el LLM solo explica una decisión ya calculada en 2-3 frases —
// no es tarea de razonamiento profundo, Haiku 4.5 basta. Configurable sin
// tocar código con ANTHROPIC_MODEL; nunca se sube de modelo en silencio.
const DEFAULT_MODEL = 'claude-haiku-4-5';
// 2-3 frases en español caben de sobra en 200 tokens; si el modelo se
// alarga, `stop_reason = max_tokens` y CoachChatService recorta a la
// última frase completa.
const MAX_OUTPUT_TOKENS = 200;
// Timeout por intento. El SDK por defecto espera hasta 10 min y reintenta
// 2 veces; para un chat eso es inaceptable. 15 s + 1 reintento → peor caso
// ~30 s antes de caer al fallback del motor.
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

export function anthropicTimeoutMs(): number {
  const fromEnv = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MS;
}
export const ANTHROPIC_MAX_RETRIES = MAX_RETRIES;

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  modelName(): string {
    return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  private getClient(): Anthropic {
    // Perezoso: el proceso arranca aunque ANTHROPIC_API_KEY no exista.
    if (!this.client) {
      this.client = new Anthropic({
        timeout: anthropicTimeoutMs(),
        maxRetries: MAX_RETRIES,
      });
    }
    return this.client;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured()) {
      throw new LlmNotConfiguredError(this.name);
    }

    const systemText = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const conversationMessages = request.messages.filter(
      (message) => message.role !== 'system',
    );
    const requestedModel = this.modelName();

    // Sin cache_control: el prompt de sistema (~400 tokens) está por debajo
    // del mínimo cacheable, así que marcarlo no ahorraba nada (medido en la
    // prueba real del 2026-09-30: 0 tokens leídos de caché).
    const startedAt = Date.now();
    const response = await this.getClient().messages.create({
      model: requestedModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemText || undefined,
      messages: conversationMessages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    });
    const latencyMs = Date.now() - startedAt;

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    return {
      content: textBlock?.text ?? '',
      providerName: this.name,
      meta: {
        model: response.model,
        requestedModel,
        ...usage,
        stopReason: response.stop_reason ?? null,
        requestId:
          (response as { _request_id?: string | null })._request_id ?? null,
        latencyMs,
        costUsd: estimateCostUsd(response.model, usage),
        pricingVersion: PRICING_VERSION,
      },
    };
  }
}
