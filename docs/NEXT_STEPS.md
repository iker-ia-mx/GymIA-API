# GymIA — Próximas 20 Tareas Priorizadas

**Fecha:** 2026-09-24
**Alcance del análisis:** ambos repos — `~/GymIA/api` (NestJS, rama `main` en `bd62f73`) y `~/GymIA/mobile` (Expo/React Native, rama `main` en `ebe8dcd`).
**Base:** hallazgos de `docs/PROJECT_STATUS.md`, `docs/TRAINING_MVP_STATUS.md`, `docs/EVOLUTION_MVP_STATUS.md` + inspección directa del repositorio en esta sesión.

Prioridad: **P0** (riesgo inmediato / bloqueante) → **P1** (calidad/testing) → **P2** (producto) → **P3** (pulido/deuda técnica menor).

---

## P0 — Riesgo inmediato

1. **Commitear y subir el trabajo del repo `mobile`.** `git status` en `~/GymIA/mobile` muestra que **todo `src/`** (Auth, Entrenar, Evolución, theming, componentes — semanas de trabajo) está sin trackear, y el único commit existente es `ebe8dcd "Initial commit"` (el scaffold vacío de Expo). Hoy este trabajo solo existe en el disco local; cualquier pérdida del entorno lo destruye por completo. Es la tarea de mayor riesgo del proyecto.
2. **Añadir `.env.example`** en `api` documentando `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT` — hoy no existe, lo que bloquea el onboarding de cualquier otro desarrollador o un despliegue limpio.
3. **Restringir CORS** antes de exponer el backend fuera de desarrollo local. `main.ts` usa `app.enableCors()` sin configuración, lo que acepta cualquier origen.
4. **Rate limiting en `/auth/login` y `/auth/register`** (`@nestjs/throttler`) — hoy no existe ninguna protección contra fuerza bruta o abuso.
5. **Eliminar el usuario de prueba residual en Supabase** (`evolution-audit-*@example.com`, creado durante la verificación de regresión de Evolución) antes de cualquier demo o entrega a stakeholders.

## P1 — Calidad y testing

6. **Tests unitarios para `WorkoutsService`** (cálculo de PR, filtrado por `userId`, transiciones de estado de sesión) — hoy solo `AuthService` tiene cobertura automatizada (7 tests); Entrenar fue auditado manualmente.
7. **Tests unitarios para `EvolutionService`** (1RM/Epley, bucketing semanal, récords recientes) — mismo caso, auditado en vivo pero sin suite automatizada.
8. **Tests e2e del backend.** Existe `vitest.config.e2e.ts` y el script `npm run test:e2e`, pero no hay ni un spec escrito — la infraestructura está lista y sin usar.
9. **Introducir testing en `mobile`.** El proyecto no tiene ni un archivo de test ni configuración de test runner — toda la verificación de UI hecha hasta ahora fue manual (navegador/Figma). Empezar por los flujos críticos: login/registro y el guard de sesión (`ctx`/`SessionProvider`).
10. **CI básica en ambos repos** (GitHub Actions): lint + build + test en cada PR. Hoy no existe ningún workflow propio en ninguno de los dos repos — solo los de `node_modules` de terceros.

## P2 — Producto

11. **Spike técnico de Nutrición vs. Composición Corporal** para decidir la Fase 3. Nutrición requiere infraestructura de visión/IA y base de datos de alimentos que aún no existe; Composición Corporal podría construirse sobre el módulo Evolución ya existente con menos esfuerzo. Definir con producto antes de comprometer sprint.
12. **Construir la pantalla de Perfil.** Hoy (`(app)/perfil.tsx`) solo muestra el email y un botón de cerrar sesión — sin edición de datos, preferencias (unidades kg/lb), ni configuración. Es una de las 4 pestañas principales y la más incompleta.
13. **Mecanismo de refresh token.** El JWT actual expira sin renovación — el usuario debe volver a autenticarse manualmente cuando expira. Afecta directamente la retención en una app de hábito diario como esta.
14. **Recalibrar la fórmula de `progressScore`** (60% frecuencia / 40% tendencia) con datos de uso real una vez haya usuarios activos — hoy es una heurística sin validar.
15. **Paginación o agregación precalculada para `getCompletedSets`.** El módulo Evolución trae todo el historial completo de series en cada request; funciona bien para el MVP pero degradará con usuarios de larga trayectoria.

## P3 — Pulido y deuda técnica menor

16. **Migrar `WorkoutSession.status` de `String` libre a `enum` de Prisma** (`in_progress | completed | abandoned`) — hoy no hay validación a nivel de base de datos contra valores inválidos.
17. **Migrar `JwtAuthGuard` al patrón estándar de NestJS** (`@nestjs/passport` + `passport-jwt`) en vez de la verificación manual actual — funciona, pero dificultará añadir roles/scopes (p. ej. admin, entrenador) más adelante.
18. **Manejo de errores/estado offline en `mobile`.** No hay error boundary global ni manejo explícito de pérdida de conexión — hoy cada pantalla maneja sus propios `try/catch` de forma aislada.
19. **Pase de accesibilidad en `mobile`** (labels de screen reader, contraste de color, soporte de tamaño de fuente dinámico) — no evaluado todavía en ninguna de las pantallas implementadas.
20. **Consolidar la documentación de estado.** Hoy conviven `STATUS.md`, `TRAINING_MVP_STATUS.md`, `EVOLUTION_MVP_STATUS.md` y `PROJECT_STATUS.md` en `api/docs/`. Mantener `PROJECT_STATUS.md` como fuente única de verdad del estado general, con los demás como reportes de auditoría históricos enlazados desde ahí — evita que la documentación se desactualice de forma inconsistente.

---

## Nota sobre el hallazgo #1

La tarea 1 (commit del repo `mobile`) se lista primero porque es la única de esta lista con riesgo de **pérdida irreversible de trabajo ya hecho**, no de trabajo futuro. Se recomienda resolverla en la próxima sesión antes de tocar cualquier otra cosa en `mobile`.
