# Sprint de Deuda Técnica — Semana 3, Fase 3

**Fecha:** 2026-09-24
**Alcance:** backend únicamente (`~/GymIA/api`). **Sin cambios en `mobile/`** — según lo pedido. Los 6 ítems venían de `docs/NEXT_STEPS.md` (P0/P1) y `docs/PROJECT_STATUS.md` (Deuda técnica).

---

## 1. `.env.example`

**Estado: resuelto.** Creado `api/.env.example` con las 8 variables requeridas (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `PORT`), cada una con un comentario explicando su propósito y dónde obtener el valor real. Sin secretos reales — solo placeholders. Cierra el bloqueante de onboarding documentado en `NEXT_STEPS.md` #1.

## 2. CORS

**Estado: resuelto.** `main.ts` ya no usa `app.enableCors()` sin argumentos (aceptaba cualquier origen). Ahora lee `CORS_ORIGIN` desde `ConfigService` (lista separada por comas) y, si no está definida, usa un default seguro de desarrollo (`http://localhost:8081`, `http://localhost:19006` — los puertos de Metro web). En producción, `CORS_ORIGIN` debe configurarse explícitamente con el dominio real de la app.

Verificado que el default de desarrollo no rompe el flujo actual: la app mobile (Metro web en `:8081`) siguió funcionando sin cambios durante toda la verificación de esta sesión.

## 3. Rate limiting

**Estado: resuelto.** Instalado `@nestjs/throttler@^6.7.1` (compatible con NestJS 12 ya instalado). Configuración:
- **Global**: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])` + `ThrottlerGuard` como `APP_GUARD` en `app.module.ts` — 60 requests/minuto por IP en cualquier endpoint.
- **Estricto en Auth**: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` en `/auth/register`, `/auth/login` y `/auth/refresh` — 10 requests/minuto, protección específica contra fuerza bruta.

**Verificado en vivo**: 12 requests consecutivas a `/auth/login` con credenciales inválidas → las primeras 9 devuelven `400` (validación), a partir de la 10ª devuelve `429 Too Many Requests`.

## 4. Refresh tokens

**Estado: resuelto en backend.** Mecanismo completo con rotación:

- Nuevo modelo Prisma `RefreshToken` (`userId`, `tokenHash` único, `expiresAt`, `revokedAt` nullable, relación a `User` con `onDelete: Cascade`) — migración `20260924135419_add_refresh_tokens`, revisada antes de aplicar (solo `CREATE TABLE`, cero cambios a tablas existentes).
- El token crudo (`crypto.randomBytes(40).toString('hex')`) se entrega al cliente; solo su hash SHA-256 se guarda en base de datos — igual que nunca se guarda una contraseña en texto plano.
- `POST /auth/login` ahora devuelve `{ accessToken, refreshToken, user }` — **cambio aditivo y retrocompatible**: el campo `refreshToken` es nuevo, `accessToken` y `user` no cambiaron de forma. El cliente mobile actual (que solo lee `accessToken` y `user`) sigue funcionando sin modificación.
- Nuevo `POST /auth/refresh` (`RefreshTokenDto { refreshToken }`): valida el token (existe, no revocado, no expirado), **rota** — revoca el usado y emite uno nuevo — y devuelve un nuevo `accessToken`. Expiración del refresh token: 30 días.
- `POST /auth/register`, `AuthController`, `LoginDto`, `RegisterDto` y el flujo de login/registro **no se modificaron** en su comportamiento existente — solo se añadió, nunca se quitó ni se cambió forma.

**Verificado en vivo**: login devuelve ambos tokens; `/auth/refresh` con el refresh token válido devuelve un nuevo `accessToken` + `refreshToken`; reutilizar el refresh token ya rotado devuelve `401` (confirma que la rotación invalida el anterior, no solo emite uno nuevo en paralelo).

**Pendiente (fuera de alcance de esta tarea, requiere tocar `mobile/`):** el cliente mobile todavía no usa el refresh token — `ctx.tsx` solo guarda `accessToken`. Cuando el JWT expire (`JWT_EXPIRES_IN=1d`), el usuario seguirá teniendo que volver a iniciar sesión manualmente hasta que se conecte este flujo en mobile (guardar el `refreshToken`, interceptar un `401` de token expirado, llamar a `/auth/refresh`, reintentar). Este es exactamente el ítem #12 de `NEXT_STEPS.md`, ahora con el backend ya listo para soportarlo.

## 5. CI

**Estado: resuelto para el repo `api`.** Nuevo `.github/workflows/ci.yml`: en cada push/PR a `main`, instala dependencias, genera el cliente Prisma, corre `npm run lint`, `npm run build` y `npm run test`. No requiere base de datos real (lint/build no la tocan; los tests unitarios usan Prisma mockeado).

**No se tocó `mobile/`** — según la restricción explícita de esta tarea. CI para `mobile` (lint + `tsc --noEmit`) sigue pendiente como ítem separado.

## 6. Tests

**Estado: resuelto para los módulos de negocio más críticos sin cobertura.** Dos archivos nuevos:

- `src/workouts/workouts.service.spec.ts` — 15 tests: ownership de sesión (`getSession`), conflicto de sesión activa y validación de rutina (`startSession`, incluyendo que las series se pre-cargan con el mejor peso histórico), lógica de `completedAt` en `updateSet`, y **cálculo de PR** en `finishSession` (volumen total solo con series completadas, PR detectado correctamente, PR no reportado cuando el histórico ya era igual o mayor, ejercicio sin series completadas no genera falso PR).
- `src/evolution/evolution.service.spec.ts` — 15 tests: ventana de 14 días de récords recientes (incluye/excluye correctamente), máximo por ejercicio (no el más reciente), fórmula de Epley para 1RM estimado (incluye el caso donde un peso menor con más repeticiones da un 1RM mayor), orden descendente por 1RM, aislamiento correcto entre ejercicios en `getExerciseHistory`, y los 3 estados vacíos (sin historial, ejercicio nunca entrenado, un solo punto → `percentChange: 0`).

**Total de la suite**: 38 tests (antes: 7), 4 archivos, 100% pasando. `AuthService` también ganó 4 tests nuevos para `refreshTokens` (válido con rotación, inexistente, revocado, expirado) al añadir esa funcionalidad.

No se buscó cobertura exhaustiva línea por línea — se priorizó la lógica de negocio con más riesgo real (cálculo de PR, 1RM, ventanas de tiempo, ownership), consistente con cómo se auditaron estos módulos manualmente en `TRAINING_MVP_STATUS.md` y `EVOLUTION_MVP_STATUS.md`.

## Validación final

```
npm run build   → sin errores
npm run test    → 38/38 tests pasando
npm run lint    → 0 errores (oxlint --type-aware)
```

Migraciones aplicadas en esta sesión: `20260924135419_add_refresh_tokens` (revisada antes de aplicar, sin tocar tablas existentes).

## Resumen de archivos

**Nuevos**
- `.env.example`
- `.github/workflows/ci.yml`
- `src/auth/dto/refresh-token.dto.ts`
- `prisma/migrations/20260924135419_add_refresh_tokens/migration.sql`
- `src/workouts/workouts.service.spec.ts`
- `src/evolution/evolution.service.spec.ts`

**Modificados**
- `src/main.ts` — CORS restringido vía `CORS_ORIGIN`
- `src/app.module.ts` — `ThrottlerModule` + `ThrottlerGuard` global
- `src/auth/auth.controller.ts` — `@Throttle` en las 3 rutas de auth, nuevo endpoint `POST /auth/refresh`
- `src/auth/auth.service.ts` — emisión y rotación de refresh tokens
- `src/auth/auth.service.spec.ts` — actualizado para el nuevo mock de `refreshToken` + 4 tests nuevos
- `prisma/schema.prisma` — modelo `RefreshToken` + relación en `User`
- `package.json` / `package-lock.json` — nueva dependencia `@nestjs/throttler@^6.7.1`

## Ítems de `NEXT_STEPS.md` que este sprint cierra

- P0 #1 (`.env.example`) → resuelto.
- P0 #2 (CORS) → resuelto.
- P0 #3 (rate limiting) → resuelto.
- P1 #9 (CI) → resuelto para `api`; `mobile` sigue pendiente.
- P1 #5, #6 (tests de `WorkoutsService`/`EvolutionService`) → resueltos.
- P2 #12 (refresh token) → backend resuelto; integración mobile sigue pendiente (requiere tocar `mobile/`, fuera de alcance de esta tarea).
