// Precios públicos de Anthropic en USD por millón de tokens (MTok).
// Fuente: https://platform.claude.com/docs/en/about-claude/pricing
// (consultada 2026-09-30). Actualizar aquí si cambian — es la única tabla
// que usa el Coach para estimar costo por mensaje (04.05 Proveedores y
// costos de IA). Un modelo sin precio conocido devuelve `null`: nunca se
// inventa un costo.
export const PRICING_VERSION = '2026-09-30';

export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWrite5mPerMTok: number;
};

const PRICING_BY_MODEL_PREFIX: Array<[string, ModelPricing]> = [
  [
    'claude-haiku-4-5',
    {
      inputPerMTok: 1,
      outputPerMTok: 5,
      cacheReadPerMTok: 0.1,
      cacheWrite5mPerMTok: 1.25,
    },
  ],
];

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export function findPricing(model: string): ModelPricing | null {
  const match = PRICING_BY_MODEL_PREFIX.find(([prefix]) =>
    model.startsWith(prefix),
  );
  return match ? match[1] : null;
}

export function estimateCostUsd(
  model: string,
  usage: TokenUsage,
): number | null {
  const pricing = findPricing(model);
  if (!pricing) return null;
  const usd =
    (usage.inputTokens * pricing.inputPerMTok +
      usage.outputTokens * pricing.outputPerMTok +
      usage.cacheReadTokens * pricing.cacheReadPerMTok +
      usage.cacheCreationTokens * pricing.cacheWrite5mPerMTok) /
    1_000_000;
  return Math.round(usd * 1e8) / 1e8;
}
