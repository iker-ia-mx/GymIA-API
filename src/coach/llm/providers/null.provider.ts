import { Injectable } from '@nestjs/common';
import {
  LlmNotConfiguredError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../llm-provider.interface.js';

// Proveedor por defecto cuando no hay ningún LLM conectado (`LLM_PROVIDER`
// sin definir, o valor no reconocido). Siempre `isConfigured() === false`
// — nunca genera texto. `CoachChatService` cae al mensaje real del motor
// v0 cuando recibe este proveedor, no a una respuesta simulada de aquí.
@Injectable()
export class NullLlmProvider implements LlmProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return false;
  }

  modelName(): string | null {
    return null;
  }

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    throw new LlmNotConfiguredError(this.name);
  }
}
