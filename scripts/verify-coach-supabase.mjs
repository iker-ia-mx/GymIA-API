// Verificación real del Coach contra la base configurada en .env (Supabase).
// Uso (desde ~/GymIA/api):  npm run build && npm run verify:coach
//
// Qué hace, sin mocks:
//  1. Comprueba que las migraciones del Coach estén aplicadas.
//  2. Crea un usuario de prueba (verify-coach+<fecha>@gymia.test) con perfil
//     de onboarding y una noche de sueño (recuperación 58).
//  3. Envía 6 mensajes reales al chat: los 5 primeros van a Anthropic y el
//     6.º debe caer al motor por el límite diario (reason = daily_limit).
//  4. Lee de la base Conversation, Message y providerMeta y suma tokens y
//     coste reales.
//  5. Borra el usuario de prueba (cascade) aunque algo falle.
// Coste aproximado de una ejecución: USD 0,005.
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { CoachChatService } from '../dist/coach/coach-chat.service.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

const REQUIRED_MIGRATIONS = [
  '20260930173542_add_ai_decision',
  '20260930174110_add_coach_chat',
  '20260930175057_add_onboarding_timezone',
];
const QUESTIONS = [
  'Dormí mal, ¿entreno hoy?',
  'Dame una rutina de pierna con series y pesos.',
  '¿Qué debo cenar y cuántas calorías?',
  'No quiero bajar el volumen, súbelo al 100%.',
  '¿Por qué me bajaste el volumen?',
  'Sexto mensaje del día: debe responder el motor.',
];

const log = (...args) => console.log(...args);
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exitCode = 1;
};

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const prisma = app.get(PrismaService);
const chat = app.get(CoachChatService);
let userId = null;

try {
  log(`LLM_PROVIDER=${process.env.LLM_PROVIDER ?? '(vacío)'} · ANTHROPIC_MODEL=${process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5 (default)'} · clave ${process.env.ANTHROPIC_API_KEY ? 'presente' : 'AUSENTE'}`);

  const applied = await prisma.$queryRawUnsafe(
    `select migration_name from "_prisma_migrations" where finished_at is not null and rolled_back_at is null`,
  );
  const names = new Set(applied.map((row) => row.migration_name));
  const missing = REQUIRED_MIGRATIONS.filter((name) => !names.has(name));
  if (missing.length) {
    fail(`Faltan migraciones en la base: ${missing.join(', ')}. Corre "npx prisma migrate deploy" primero.`);
  } else {
    log('✓ Migraciones del Coach aplicadas');

    const user = await prisma.user.create({
      data: { email: `verify-coach+${Date.now()}@gymia.test`, password: 'no-login', onboardingCompletedAt: new Date() },
    });
    userId = user.id;
    await prisma.onboardingProfile.create({
      data: {
        userId, goal: 'ganar_musculo', experienceLevel: 'intermedio',
        trainingDays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], sessionDurationMin: 60, location: 'gimnasio_completo',
        equipment: [], musclePriorities: [], keepExercises: [], avoidExercises: [],
      },
    });
    const start = new Date(Date.now() - 9 * 3600e3);
    await prisma.sleepSession.create({
      data: { userId, startedAt: start, endedAt: new Date(start.getTime() + 370 * 60e3), recoveryScorePct: 58, source: 'apple_health' },
    });
    log(`✓ Usuario de prueba creado (${user.email})`);

    for (const [i, q] of QUESTIONS.entries()) {
      const t0 = Date.now();
      const reply = await chat.sendMessage(userId, q);
      log(`\n${i + 1}. ${q}\n   → [${reply.providerName ?? 'motor'} · ${Date.now() - t0} ms · cupo ${reply.quota.used}/${reply.quota.limit ?? '∞'}] ${reply.content}`);
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    const messages = conversations.flatMap((c) => c.messages);
    const assistant = messages.filter((m) => m.role === 'assistant' && m.providerMeta);
    const llm = assistant.filter((m) => m.providerMeta.fallback === false);
    const limited = assistant.filter((m) => m.providerMeta.reason === 'daily_limit');
    const sum = (key) => llm.reduce((acc, m) => acc + (m.providerMeta[key] ?? 0), 0);

    log('\n── Base de datos real ──');
    log(`Conversation: ${conversations.length} (esperado 1)`);
    log(`Message: ${messages.length} (esperado 13: saludo + 6 usuario + 6 coach)`);
    log(`Respuestas del LLM con providerMeta: ${llm.length} (esperado 5)`);
    log(`Respuestas por límite diario: ${limited.length} (esperado 1)`);
    for (const m of llm) {
      const p = m.providerMeta;
      log(`  · ${p.model} in=${p.inputTokens} out=${p.outputTokens} coste=$${p.costUsd} stop=${p.stopReason} req=${p.requestId}`);
    }
    log(`Tokens totales: entrada ${sum('inputTokens')} · salida ${sum('outputTokens')}`);
    log(`Coste total real: $${sum('costUsd').toFixed(6)} USD · medio por mensaje $${(sum('costUsd') / Math.max(1, llm.length)).toFixed(6)} USD`);

    if (conversations.length !== 1) fail('Se esperaba 1 Conversation');
    if (messages.length !== 13) fail('Se esperaban 13 Message');
    if (llm.length !== 5) fail('Se esperaban 5 respuestas del LLM (¿clave o LLM_PROVIDER mal configurados? revisa los logs coach_llm_error)');
    if (limited.length !== 1) fail('El 6.º mensaje debía caer por límite diario');
    if (llm.some((m) => typeof m.providerMeta.costUsd !== 'number' || !m.providerMeta.inputTokens)) fail('providerMeta sin tokens o coste');
    if (!process.exitCode) log('\n✓ Integración Anthropic verificada contra la base real');
  }
} catch (error) {
  fail(error instanceof Error ? error.stack : String(error));
} finally {
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    const left = await prisma.message.count({ where: { conversation: { userId } } });
    log(`Limpieza: usuario de prueba borrado, mensajes restantes = ${left}`);
  }
  await app.close();
}
