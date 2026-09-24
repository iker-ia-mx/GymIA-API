# GymIA — Estado del Proyecto

**Fecha:** 2026-09-24
**Estado general:** ambos repos (backend y mobile) están respaldados en GitHub y sincronizados. El riesgo P0 identificado en `docs/NEXT_STEPS.md` (código de `mobile` sin respaldo, existiendo solo en disco local) quedó **mitigado**. Los datos de prueba residuales del módulo Evolución también fueron limpiados de Supabase — ver Riesgos pendientes.

---

## Repositorios

| Repo | URL | Rama | Último commit | Estado |
|---|---|---|---|---|
| **GymIA API** (backend, NestJS) | `https://github.com/iker-ia-mx/GymIA-API` | `main` | `6f2e665` | ✅ Respaldado y sincronizado |
| **GymIA-Mobile-App** (frontend, Expo/React Native) | `https://github.com/iker-ia-mx/GymIA-Mobile-App` | `main` | `25e3d7c` | ✅ Creado y sincronizado en esta sesión |

- `GymIA-Mobile-App` es un repositorio **nuevo**, creado en esta sesión específicamente para el código del frontend construido hasta ahora (Auth, Entrenar, Evolución). Antes de esto, todo `src/` de `mobile` existía únicamente en disco local, sin ningún respaldo remoto — el único commit previo era el scaffold vacío de `create-expo-app`.
- Se evaluó y descartó reutilizar el repositorio `gymia-mobile` (minúsculas) de la cuenta `iker-ia-mx`: contiene un proyecto GymIA distinto y no relacionado (176 commits, 2026-09-01 a 2026-09-11, con un alcance de producto mucho más amplio — generación de rutinas por IA, mundo/comunidad, nutrición, profesionales). Se dejó intacto, sin modificar.
- `git fetch` + comparación de SHA (`git rev-parse main` vs `git rev-parse origin/main`) confirmó que ambos repos tienen `origin/main` sincronizada con el historial local al cierre de esta sesión.

## Estado actual del backend

- **Stack**: NestJS 12 (ESM, `moduleResolution: nodenext`), Prisma 6.19.3 sobre Supabase Postgres, `bcrypt` + `@nestjs/jwt` para autenticación, `class-validator`/`class-transformer` con `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Build**: `npm run build` compila sin errores.
- **Tests**: `npm run test` (Vitest) — 7/7 tests pasando, 2 archivos (`app.controller.spec.ts`, `auth/auth.service.spec.ts`). Sin tests unitarios todavía para `WorkoutsService` ni `EvolutionService` (ver Deuda técnica).
- **CORS**: habilitado globalmente (`app.enableCors()`) para permitir el desarrollo web de Expo/Metro contra `localhost:3000`.
- **Migraciones**: 2 migraciones aplicadas — `0_baseline` (baseline de la tabla `User` preexistente, creada vía `init.sql`, registrada con `prisma migrate resolve --applied` sin ejecutar DDL) y `20260924030830_add_workout_module` (crea las 6 tablas del módulo Entrenar/Evolución).
- **Datasource**: `DATABASE_URL` (pooled, pgbouncer) para runtime; `DIRECT_URL` (directa) para migraciones — requerido por la incompatibilidad del pooler de Supabase con `prisma migrate`.
- **Seed**: `prisma/seed.mjs` carga 15 ejercicios base (Press de Banca, Sentadilla, Peso Muerto, etc.).

## Módulos terminados

| Módulo | Estado | Documento de auditoría |
|---|---|---|
| **Auth** (registro, login, JWT, `JwtAuthGuard`) | ✅ Completo, auditado, con tests unitarios | — |
| **Entrenar** (rutinas, sesiones, series, PRs) | ✅ Completo, auditado (guard, filtrado por usuario, cálculo de PR) | `docs/TRAINING_MVP_STATUS.md` |
| **Evolución** (progreso, récords, fuerza/1RM) | ✅ Completo, auditado con verificación de regresión en vivo | `docs/EVOLUTION_MVP_STATUS.md` |
| **Nutrición** | ⏳ No iniciado — evaluado y descartado para esta fase (requiere infraestructura de visión/IA y base de datos de alimentos aún no disponible) | `docs/STATUS.md` (evaluación de Fase 2) |

## Endpoints disponibles

Todos los endpoints salvo `auth/*` requieren `Authorization: Bearer <JWT>` y están filtrados por `userId` extraído del token vía `JwtAuthGuard` + `@CurrentUser()`.

### Auth (`/auth`) — público
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/register` | Crea un usuario (bcrypt hash) |
| `POST` | `/auth/login` | Autentica y devuelve JWT |

### Entrenar (`/workouts`) — protegido
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/workouts/exercises` | Lista el catálogo de ejercicios |
| `GET` | `/workouts/routines` | Lista las rutinas del usuario |
| `POST` | `/workouts/routines` | Crea una rutina con ejercicios objetivo |
| `GET` | `/workouts/sessions/active` | Obtiene la sesión en progreso, si existe |
| `GET` | `/workouts/sessions/:id` | Detalle de una sesión |
| `POST` | `/workouts/sessions` | Inicia una sesión a partir de una rutina |
| `POST` | `/workouts/sessions/:id/exercises/:sessionExerciseId/sets` | Añade una serie a un ejercicio de la sesión |
| `PATCH` | `/workouts/sessions/:id/sets/:setLogId` | Actualiza peso/reps/estado de una serie |
| `POST` | `/workouts/sessions/:id/finish` | Finaliza la sesión, calcula volumen total y PRs |

### Evolución (`/evolution`) — protegido
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/evolution/summary` | Puntuación de progreso, sesiones últimos 7 días, récords recientes (14 días) |
| `GET` | `/evolution/strength` | Volumen semanal + 1RM estimado actual por ejercicio |
| `GET` | `/evolution/strength/:exerciseId` | Historial semanal de 1RM estimado para un ejercicio |

## Esquema Prisma actual

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())

  routines        Routine[]
  workoutSessions WorkoutSession[]
}

model Exercise {
  id          String   @id @default(uuid())
  name        String
  muscleGroup String
  createdAt   DateTime @default(now())

  routineExercises RoutineExercise[]
  sessionExercises WorkoutSessionExercise[]
}

model Routine {
  id        String   @id @default(uuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercises RoutineExercise[]
  sessions  WorkoutSession[]

  @@index([userId])
}

model RoutineExercise {
  id         String @id @default(uuid())
  routineId  String
  exerciseId String
  order      Int
  targetSets Int
  targetReps Int

  routine  Routine  @relation(fields: [routineId], references: [id], onDelete: Cascade)
  exercise Exercise @relation(fields: [exerciseId], references: [id])

  @@index([routineId])
  @@index([exerciseId])
}

model WorkoutSession {
  id         String    @id @default(uuid())
  userId     String
  routineId  String?
  status     String    @default("in_progress") // in_progress | completed | abandoned
  startedAt  DateTime  @default(now())
  finishedAt DateTime?

  user      User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  routine   Routine?                  @relation(fields: [routineId], references: [id])
  exercises WorkoutSessionExercise[]

  @@index([userId])
  @@index([routineId])
}

model WorkoutSessionExercise {
  id         String @id @default(uuid())
  sessionId  String
  exerciseId String
  order      Int

  session  WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exercise Exercise       @relation(fields: [exerciseId], references: [id])
  sets     SetLog[]

  @@index([sessionId])
  @@index([exerciseId])
}

model SetLog {
  id                String    @id @default(uuid())
  sessionExerciseId String
  setNumber         Int
  weightKg          Float
  reps              Int
  completed         Boolean   @default(false)
  completedAt       DateTime?

  sessionExercise WorkoutSessionExercise @relation(fields: [sessionExerciseId], references: [id], onDelete: Cascade)

  @@index([sessionExerciseId])
}
```

Todas las entidades propiedad de un usuario tienen relación explícita con `User` (directa o encadenada vía `Routine`/`WorkoutSession`), con `onDelete: Cascade`, preparadas para multiusuario desde el diseño original. El módulo Evolución no añadió tablas nuevas — deriva todo de `SetLog` en tiempo de consulta.

## Riesgos pendientes

**Mitigado en esta sesión:**
- El riesgo P0 de `docs/NEXT_STEPS.md` ("código de `mobile` sin respaldo, con riesgo de pérdida irreversible") quedó resuelto — ver sección Repositorios arriba.
- **Limpieza de datos de auditoría completada (24/09/2026):** los dos usuarios de prueba residuales en Supabase (`evolution-audit-verify@example.com`, `evolution-audit-1790254510@example.com`) fueron eliminados vía `prisma.user.delete()`, aprovechando el `onDelete: Cascade` del esquema. Se verificó tras el borrado que no quedó ningún registro huérfano en `Routine`, `RoutineExercise`, `WorkoutSession`, `WorkoutSessionExercise` ni `SetLog` (chequeo global sobre toda la tabla `SetLog`, no solo los IDs afectados). Detalle completo en `docs/EVOLUTION_MVP_STATUS.md`.

- **`getCompletedSets` sin paginación ni caché**: el módulo Evolución trae todas las series completadas del usuario en cada request. Aceptable para el volumen actual, pero escalará mal con usuarios de largo historial.
- **`progressScore` es una heurística fija (60% frecuencia / 40% tendencia)**, no validada con datos de uso real — puede necesitar recalibración.
- **`WorkoutSession.status`** es un `String` libre (`"in_progress" | "completed" | "abandoned"`) en vez de un enum de Prisma — sin validación a nivel de base de datos contra valores inválidos.
- **Sin rate limiting** en `/auth/login` ni `/auth/register` — expuesto a fuerza bruta/abuso si el proyecto sale de fase MVP.
- **CORS abierto sin restricción de origen** (`app.enableCors()` sin configuración) — correcto para desarrollo, debe restringirse antes de producción.

## Deuda técnica

- **Sin tests unitarios para `WorkoutsService` ni `EvolutionService`** — solo `AuthService` tiene cobertura (7 tests). Ambos módulos fueron auditados manualmente vía verificación en vivo, no vía suite automatizada.
- **Sin tests e2e** — existe `vitest.config.e2e.ts` y el script `test:e2e`, pero no hay specs escritos todavía.
- **JWT sin refresh token**: el token expira (payload `exp`) sin mecanismo de renovación; el usuario debe volver a iniciar sesión.
- **`JwtAuthGuard` duplica lógica de verificación** que `@nestjs/jwt` ya ofrece via estrategias de Passport — funciona correctamente pero no sigue el patrón estándar de NestJS (`@nestjs/passport` + `passport-jwt`), lo que puede dificultar añadir roles/scopes más adelante.
- **Falta `.env.example`** documentando las variables requeridas (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT`) para onboarding de nuevos desarrolladores.

## Próximo sprint recomendado

1. **Cerrar deuda de testing crítica**: escribir tests unitarios para `WorkoutsService` (cálculo de PR, filtrado por usuario) y `EvolutionService` (1RM, agregación semanal, récords recientes) — son los módulos con más lógica de negocio y cero cobertura automatizada.
2. **Rate limiting básico** en `/auth/login` y `/auth/register` (`@nestjs/throttler`) antes de exponer el backend fuera de desarrollo.
3. **`.env.example`** + documentación de variables de entorno requeridas.
4. **Decisión de producto sobre Fase 3**: confirmar si se avanza con Nutrición (requiere spike de infraestructura IA/visión) o se prioriza pulir Composición Corporal dentro de Evolución.

~~5. Limpieza de datos de prueba en Supabase~~ — **completado el 24/09/2026**, ver Riesgos pendientes.
