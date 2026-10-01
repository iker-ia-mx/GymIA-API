import { Injectable } from '@nestjs/common';
import {
  LlmNotConfiguredError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../llm-provider.interface.js';

// Adapter para Azure OpenAI. Activarlo: `LLM_PROVIDER=azure_openai` +
// `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` y
// `AZURE_OPENAI_DEPLOYMENT` en `.env`, instalar el SDK oficial
// (`npm install openai` funciona también para Azure con `baseURL`) y
// reemplazar el cuerpo de `complete()` por la llamada real.
@Injectable()
export class AzureOpenAiProvider implements LlmProvider {
  readonly name = 'azure_openai';

  isConfigured(): boolean {
    return (
      !!process.env.AZURE_OPENAI_API_KEY &&
      !!process.env.AZURE_OPENAI_ENDPOINT &&
      !!process.env.AZURE_OPENAI_DEPLOYMENT
    );
  }

  modelName(): string | null {
    return null;
  }

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.isConfigured()) {
      throw new LlmNotConfiguredError(this.name);
    }
    // TODO(04.05 Proveedores y costos de IA): implementar la llamada real
    // al SDK de Azure OpenAI aquí cuando se elija este proveedor.
    throw new Error('AzureOpenAiProvider.complete: SDK todavía no conectado.');
  }
}
