import { describe, expect, it } from 'vitest';
import {
  buildSystemPrompt,
  HISTORY_WINDOW_MESSAGES,
  selectRecentHistory,
} from './coach-chat.service.js';
import { guardCoachReply } from './coach-reply.guard.js';
import type { TodayDecision } from './coach.service.js';
import { estimateCostUsd } from './llm/pricing.js';

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

describe('guardCoachReply (DEC-014)', () => {
  it('quita títulos, markdown, viñetas y emojis y deja un párrafo', () => {
    const raw =
      '# Coach GymIA 💪\n\n**Sí, entrena hoy.**\n- Tu recuperación fue de 58.\n- Bajamos el volumen al 90%. 🔥';
    const { text, modified } = guardCoachReply(raw, 'end_turn');
    expect(modified).toBe(true);
    expect(text).toBe(
      'Sí, entrena hoy. Tu recuperación fue de 58. Bajamos el volumen al 90%.',
    );
    expect(text).not.toMatch(/[#*💪🔥\n]/u);
  });

  it('corta a 3 frases como máximo', () => {
    const { text } = guardCoachReply(
      'Uno. Dos. Tres. Cuatro. Cinco.',
      'end_turn',
    );
    expect(text).toBe('Uno. Dos. Tres.');
  });

  it('si se truncó por max_tokens descarta la frase incompleta', () => {
    const { text } = guardCoachReply(
      'Hoy entrenas con menos volumen. Tu recuperación fue',
      'max_tokens',
    );
    expect(text).toBe('Hoy entrenas con menos volumen.');
  });

  it('no toca una respuesta ya correcta', () => {
    const ok =
      'Hoy sí entrenas, pero al 90% de tu volumen. Tu recuperación de anoche fue de 58 de 100.';
    expect(guardCoachReply(ok, 'end_turn')).toEqual({
      text: ok,
      modified: false,
    });
  });
});

describe('selectRecentHistory', () => {
  it('envía como máximo la ventana y siempre empieza con el usuario', () => {
    const history = Array.from({ length: 11 }, (_, i) => ({
      role: i % 2 === 0 ? 'assistant' : 'user',
      content: `m${i}`,
    }));
    const recent = selectRecentHistory(history);
    expect(recent.length).toBeLessThanOrEqual(HISTORY_WINDOW_MESSAGES);
    expect(recent[0].role).toBe('user');
    expect(recent.at(-1)?.content).toBe('m10');
  });

  it('descarta el saludo inicial del motor si va primero', () => {
    const recent = selectRecentHistory([
      { role: 'assistant', content: 'saludo' },
      { role: 'user', content: 'hola' },
    ]);
    expect(recent).toEqual([{ role: 'user', content: 'hola' }]);
  });
});

describe('buildSystemPrompt', () => {
  it('incluye solo los datos del motor y las reglas de DEC-014', () => {
    const prompt = buildSystemPrompt(decision);
    expect(prompt).toContain(decision.message);
    expect(prompt).toContain('58 de 100');
    expect(prompt).toContain('90% del plan normal');
    expect(prompt).toMatch(/español/);
    expect(prompt).toMatch(/Máximo 3 frases/);
    expect(prompt).toMatch(/sin markdown/);
    expect(prompt).toMatch(/sin emojis/);
    expect(prompt).toMatch(/No inventes planes/);
    expect(prompt).toMatch(/No inventes nutrición/);
    expect(prompt).toMatch(/No inventes métricas/);
  });
});

describe('estimateCostUsd', () => {
  it('usa el precio de Haiku 4.5 (USD 1 / 5 por MTok)', () => {
    expect(
      estimateCostUsd('claude-haiku-4-5-20251001', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }),
    ).toBe(6);
  });

  it('devuelve null para un modelo sin precio conocido', () => {
    expect(
      estimateCostUsd('modelo-x', {
        inputTokens: 10,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }),
    ).toBeNull();
  });
});
