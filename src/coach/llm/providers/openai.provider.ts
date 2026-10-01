import { Injectable } from '@nestjs/common';
import {
  LlmNotConfiguredError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../llm-provider.interface.js';

// Adapter para OpenAI. Activarlo: `LLM_PROVIDER=openai` +
// `OPENAI_API_KEY` en `.env`, instalar el SDK oficial (`npm install
// openai`) y reemplazar el cuerpo de `complete()` por una llamada real a
// `client.chat.completions.create(...)` con `request.messages`. Nada de
// esto se ejecuta mientras `OPENAI_API_KEY` no exista.
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  modelName(): string | null {
    return null;
  }

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured()) {
      throw new LlmNotConfiguredError(this.name);
    }
    // TODO(04.05 Proveedores y costos de IA): implementar la llamada real
    // al SDK de OpenAI aquí cuando se elija este proveedor.
    throw new Error('OpenAiProvider.complete: SDK todavía no conectado.');
  }
}
