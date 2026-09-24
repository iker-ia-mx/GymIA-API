# GymIA — Próximas Tareas Priorizadas

**Fecha:** 2026-09-24 (actualizado)
**Alcance del análisis:** ambos repos — `~/GymIA/api` (NestJS) y `~/GymIA/mobile` (Expo/React Native).
**Base:** hallazgos de `docs/PROJECT_STATUS.md`, `docs/TRAINING_MVP_STATUS.md`, `docs/EVOLUTION_MVP_STATUS.md` + inspección directa del repositorio en esta sesión.

Prioridad: **P0** (riesgo inmediato / bloqueante) → **P1** (calidad/testing) → **P2** (producto) → **P3** (pulido/deuda técnica menor).
Estado: 1 tarea completada, 19 pendientes.

---

## Completadas

- ✅ **Respaldo de código en GitHub (riesgo P0 original).** Mitigado el **24/09/2026**.
  - `GymIA-API` está respaldado y sincronizado (`https://github.com/iker-ia-mx/GymIA-API`).
  - `GymIA-Mobile-App` fue creado y sincronizado en esta sesión (`https://github.com/iker-ia-mx/GymIA-Mobile-App`) — antes, todo `src/` de `mobile` (Auth, Entrenar, Evolución, theming, componentes) existía únicamente en disco local, sin ningún respaldo remoto.
  - Ambos repos tienen `origin/main` actualizado, verificado con `git fetch` + comparación de SHA (`git rev-parse main` == `git rev-parse origin/main`) en los dos casos.
  - El riesgo de **pérdida irreversible de trabajo ya hecho** que motivaba esta tarea queda mitigado. Detalle completo en `docs/PROJECT_STATUS.md` (sección "Repositorios").

## P0 — Riesgo inmediato

1. **Añadir `.env.example`** en `api` documentando `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT` — hoy no existe, lo que bloquea el onboarding de cualquier otro desarrollador o un despliegue limpio.
2. **Restringir CORS** antes de exponer el backend fuera de desarrollo local. `main.ts` usa `app.enableCors()` sin configuración, lo que acepta cualquier origen.
3. **Rate limiting en `/auth/login` y `/auth/register`** (`@nestjs/throttler`) — hoy no existe ninguna protección contra fuerza bruta o abuso.
4. **Eliminar el usuario de prueba residual en Supabase** (`evolution-audit-*@example.com`, creado durante la verificación de regresión de Evolución) antes de cualquier demo o entrega a stakeholders.

## P1 — Calidad y testing

5. **Tests unitarios para `WorkoutsService`** (cálculo de PR, filtrado por `userId`, transiciones de estado de sesión) — hoy solo `AuthService` tiene cobertura automatizada (7 tests); Entrenar fue auditado manualmente.
6. **Tests unitarios para `EvolutionService`** (1RM/Epley, bucketing semanal, récords recientes) — mismo caso, auditado en vivo pero sin suite automatizada.
7. **Tests e2e del backend.** Existe `vitest.config.e2e.ts` y el script `npm run test:e2e`, pero no hay ni un spec escrito — la infraestructura está lista y sin usar.
8. **Introducir testing en `mobile`.** El proyecto no tiene ni un archivo de test ni configuración de test runner — toda la verificación de UI hecha hasta ahora fue manual (navegador/Figma). Empezar por los flujos críticos: login/registro y el guard de sesión (`ctx`/`SessionProvider`).
9. **CI básica en ambos repos** (GitHub Actions): lint + build + test en cada PR. Hoy no existe ningún workflow propio en ninguno de los dos repos — solo los de `node_modules` de terceros.

## P2 — Producto

10. **Spike técnico de Nutrición vs. Composición Corporal** para decidir la Fase 3. Nutrición requiere infraestructura de visión/IA y base de datos de alimentos que aún no existe; Composición Corporal podría construirse sobre el módulo Evolución ya existente con menos esfuerzo. Definir con producto antes de comprometer sprint.
11. **Construir la pantalla de Perfil.** Hoy (`(app)/perfil.tsx`) solo muestra el email y un botón de cerrar sesión — sin edición de datos, preferencias (unidades kg/lb), ni configuración. Es una de las 4 pestañas principales y la más incompleta.
12. **Mecanismo de refresh token.** El JWT actual expira sin renovación — el usuario debe volver a autenticarse manualmente cuando expira. Afecta directamente la retención en una app de hábito diario como esta.
13. **Recalibrar la fórmula de `progressScore`** (60% frecuencia / 40% tendencia) con datos de uso real una vez haya usuarios activos — hoy es una heurística sin validar.
14. **Paginación o agregación precalculada para `getCompletedSets`.** El módulo Evolución trae todo el historial completo de series en cada request; funciona bien para el MVP pero degradará con usuarios de larga trayectoria.

## P3 — Pulido y deuda técnica menor

15. **Migrar `WorkoutSession.status` de `String` libre a `enum` de Prisma** (`in_progress | completed | abandoned`) — hoy no hay validación a nivel de base de datos contra valores inválidos.
16. **Migrar `JwtAuthGuard` al patrón estándar de NestJS** (`@nestjs/passport` + `passport-jwt`) en vez de la verificación manual actual — funciona, pero dificultará añadir roles/scopes (p. ej. admin, entrenador) más adelante.
17. **Manejo de errores/estado offline en `mobile`.** No hay error boundary global ni manejo explícito de pérdida de conexión — hoy cada pantalla maneja sus propios `try/catch` de forma aislada.
18. **Pase de accesibilidad en `mobile`** (labels de screen reader, contraste de color, soporte de tamaño de fuente dinámico) — no evaluado todavía en ninguna de las pantallas implementadas.
19. **Consolidar la documentación de estado.** Hoy conviven `STATUS.md`, `TRAINING_MVP_STATUS.md`, `EVOLUTION_MVP_STATUS.md` y `PROJECT_STATUS.md` en `api/docs/`. Mantener `PROJECT_STATUS.md` como fuente única de verdad del estado general, con los demás como reportes de auditoría históricos enlazados desde ahí — evita que la documentación se desactualice de forma inconsistente.
