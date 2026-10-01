import { Injectable } from '@nestjs/common';
import {
  LlmNotConfiguredError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../llm-provider.interface.js';

// Adapter para Google Gemini. Activarlo: `LLM_PROVIDER=gemini` +
// `GEMINI_API_KEY` en `.env`, instalar el SDK oficial (`npm install
// @google/generative-ai`) y reemplazar el cuerpo de `complete()` por una
// llamada real a `model.generateContent(...)` con `request.messages`.
@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  modelName(): string | null {
    return null;
  }

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured()) {
      throw new LlmNotConfiguredError(this.name);
    }
    // TODO(04.05 Proveedores y costos de IA): implementar la llamada real
    // al SDK de Gemini aquí cuando se elija este proveedor.
    throw new Error('GeminiProvider.complete: SDK todavía no conectado.');
  }
}
