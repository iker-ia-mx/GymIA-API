import { Injectable } from '@nestjs/common';
import type { LlmProvider } from './llm-provider.interface.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { AzureOpenAiProvider } from './providers/azure-openai.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { NullLlmProvider } from './providers/null.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';

// Único punto de decisión de qué proveedor usa el Coach — controlado por
// la variable de entorno `LLM_PROVIDER` (openai | azure_openai |
// anthropic | gemini). Conectar un proveedor nuevo es: implementar su
// adapter (`LlmProvider`), añadirlo aquí, y poner la variable de entorno.
// Nunca hay que tocar `CoachChatService` ni los endpoints.
@Injectable()
export class LlmProviderFactory {
  constructor(
    private readonly openAi: OpenAiProvider,
    private readonly azureOpenAi: AzureOpenAiProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly gemini: GeminiProvider,
    private readonly nullProvider: NullLlmProvider,
  ) {}

  getActiveProvider(): LlmProvider {
    switch (process.env.LLM_PROVIDER) {
      case 'openai':
        return this.openAi;
      case 'azure_openai':
        return this.azureOpenAi;
      case 'anthropic':
        return this.anthropic;
      case 'gemini':
        return this.gemini;
      default:
        return this.nullProvider;
    }
  }
}
