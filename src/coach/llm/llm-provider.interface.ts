// Puerto (patrón adapter) para conectar cualquier proveedor de LLM al
// Coach GymIA sin tocar `CoachChatService` ni el resto del backend — solo
// se añade una clase nueva que implemente `LlmProvider` y una entrada en
// `LlmProviderFactory`. `isConfigured()` es la única puerta: si es falso,
// `CoachChatService` nunca llama a `complete()`.

export type LlmRole = 'system' | 'user' | 'assistant';

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmCompletionRequest = {
  messages: LlmMessage[];
};

// Lo que se guarda en `Message.providerMeta` cuando responde un LLM real.
export type LlmUsageMeta = {
  model: string; // modelo que respondió (devuelto por el proveedor)
  requestedModel: string; // modelo pedido (ANTHROPIC_MODEL o default)
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  stopReason: string | null;
  requestId: string | null;
  latencyMs: number;
  costUsd: number | null; // null = modelo sin precio conocido en pricing.ts
  pricingVersion: string;
};

export type LlmCompletionResult = {
  content: string;
  providerName: string;
  meta: LlmUsageMeta;
};

export class LlmNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`El proveedor de LLM "${providerName}" no está configurado todavía.`);
    this.name = 'LlmNotConfiguredError';
  }
}

export interface LlmProvider {
  readonly name: string;
  // Debe ser barato y síncrono en la práctica (lee variables de entorno,
  // no hace red) — se llama en cada mensaje para decidir si se puede usar.
  isConfigured(): boolean;
  // Modelo que se pediría ahora mismo (para logs de error con contexto).
  modelName(): string | null;
  // Solo debe llamarse cuando `isConfigured()` es verdadero. Un adapter
  // correcto lanza `LlmNotConfiguredError` si se llama de todas formas —
  // nunca debe devolver una respuesta inventada.
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
