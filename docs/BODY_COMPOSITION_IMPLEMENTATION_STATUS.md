# Composición Corporal — Estado de Implementación (Backend, Fase 1)

**Fecha:** 2026-09-24
**Alcance:** solo backend, siguiendo `docs/BODY_COMPOSITION_DESIGN.md`. **Sin cambios en `mobile/`** — según lo pedido.

---

## 1. Diff de Prisma

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index bab03e2..7af8de1 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -16,6 +16,8 @@ model User {
 
   routines        Routine[]
   workoutSessions WorkoutSession[]
+  bodyMetrics     BodyMetric[]
+  progressPhotos  ProgressPhoto[]
 }
 
 model Exercise {
@@ -99,3 +101,33 @@ model SetLog {
 
   @@index([sessionExerciseId])
 }
+
+model BodyMetric {
+  id         String   @id @default(uuid())
+  userId     String
+  recordedAt DateTime @default(now())
+  weightKg   Float
+  bodyFatPct Float?
+  leanMassKg Float?
+  waistCm    Float?
+  createdAt  DateTime @default(now())
+
+  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@index([userId])
+  @@index([userId, recordedAt])
+}
+
+model ProgressPhoto {
+  id          String   @id @default(uuid())
+  userId      String
+  storagePath String
+  contentType String   @default("image/jpeg")
+  takenAt     DateTime @default(now())
+  createdAt   DateTime @default(now())
+
+  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@index([userId])
+  @@index([userId, takenAt])
+}
```

Migración generada y aplicada: `prisma/migrations/20260924133218_add_body_composition_module/`. Revisada antes de aplicar — contiene únicamente `CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT` para las dos tablas nuevas; **cero `ALTER`/`DROP` sobre tablas existentes**, mismo perfil de riesgo que la migración de Entrenar/Evolución.

## 2. Endpoints creados

Todos bajo `@UseGuards(JwtAuthGuard)`, filtrados por `userId` desde el JWT, con verificación explícita de ownership antes de cualquier `DELETE`.

| Método | Ruta | DTO | Descripción |
|---|---|---|---|
| `POST` | `/body-metrics` | `CreateBodyMetricDto` | Registra una medición (`weightKg` requerido; `bodyFatPct`, `leanMassKg`, `waistCm`, `recordedAt` opcionales) |
| `GET` | `/body-metrics` | — | Historial completo, orden descendente por `recordedAt` |
| `GET` | `/body-metrics/latest` | — | Última medición (`null` si no hay ninguna — estado vacío, no error) |
| `DELETE` | `/body-metrics/:id` | — | Elimina una medición (404 si no existe, 403 si no es del usuario) |
| `POST` | `/progress-photos/upload-url` | `CreateUploadUrlDto` | Genera `storagePath` + URL firmada de **subida** (TTL 5 min) |
| `POST` | `/progress-photos` | `CreateProgressPhotoDto` | Registra una foto tras subida exitosa (valida que `storagePath` pertenezca al usuario) |
| `GET` | `/progress-photos` | — | Lista fotos con URL firmada de **lectura** (TTL 1 hora) generada en cada request |
| `DELETE` | `/progress-photos/:id` | — | Borra el archivo en Storage **antes** de borrar la fila (404/403 igual que arriba) |

**Nota sobre rutas**: siguiendo la instrucción explícita de esta tarea, las rutas usan los prefijos `/body-metrics` y `/progress-photos` como dos recursos separados (no `/body-metrics/photos/*` como se bocetó en `BODY_COMPOSITION_DESIGN.md`). Un solo `BodyCompositionController` (sin prefijo de clase) expone ambos, con la ruta completa en cada decorador de método — se mantiene un único módulo con 3 archivos (`module`/`service`/`controller`) tal como se pidió.

## 3. Archivos creados/modificados

**Nuevos**
- `src/body-composition/body-composition.module.ts`
- `src/body-composition/body-composition.service.ts`
- `src/body-composition/body-composition.controller.ts`
- `src/body-composition/dto/create-body-metric.dto.ts`
- `src/body-composition/dto/create-upload-url.dto.ts`
- `src/body-composition/dto/create-progress-photo.dto.ts`
- `prisma/migrations/20260924133218_add_body_composition_module/migration.sql`

**Modificados**
- `prisma/schema.prisma` — 2 modelos nuevos + 2 relaciones en `User` (diff arriba)
- `src/app.module.ts` — registra `BodyCompositionModule`
- `package.json` / `package-lock.json` — nueva dependencia `@supabase/supabase-js@^2.117.1`
- `.env` (no versionado) — nuevas variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

## 4. Estrategia de storage implementada

Tal como se diseñó: el backend **nunca maneja bytes de imagen**. `BodyCompositionService` mantiene un cliente de Supabase Storage construido de forma **perezosa** (`getStorageBucket()`, solo al primer uso) — decisión deliberada distinta a cómo se configura `JwtModule` (que sí falla al arrancar si falta `JWT_SECRET`): así, la ausencia de credenciales de Supabase no impide que el resto de la API (Auth, Entrenar, Evolución, `/body-metrics/*`) siga funcionando con normalidad. Verificado en vivo (ver sección 6).

- `POST /progress-photos/upload-url` genera `storagePath = {userId}/{uuid}.{ext}` y pide a Supabase una URL de subida firmada (`createSignedUploadUrl`).
- `POST /progress-photos` valida que el `storagePath` recibido empiece con `{userId}/` antes de registrar la fila — bloquea que un usuario registre una foto apuntando a la ruta de otro.
- `GET /progress-photos` genera una URL de lectura firmada (`createSignedUrl`, 1 hora) por cada foto en el momento de la consulta, tras confirmar que la fila pertenece al usuario autenticado.
- `DELETE /progress-photos/:id` llama a `bucket.remove([storagePath])` **antes** de borrar la fila en Postgres; si el borrado en Storage falla, se lanza `500` y la fila **no** se borra — evita el escenario más peligroso (fila borrada, archivo huérfano sin ninguna referencia).

## 5. Seguridad y validación

- `JwtAuthGuard` en los 8 endpoints (vía `@UseGuards(JwtAuthGuard)` a nivel de controller).
- Ownership verificado explícitamente con fetch-then-compare (`NotFoundException` si no existe, `ForbiddenException` si pertenece a otro usuario) — mismo patrón ya usado en `WorkoutsService.getSession`.
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) aplica a los 3 DTOs nuevos igual que al resto de la API.
- `contentType` de fotos restringido a `image/jpeg`/`image/png` vía `@IsIn` en `CreateUploadUrlDto`.

## 6. Validación ejecutada

- **`npm run build`**: ✅ sin errores.
- **`npm run test`**: ✅ 7/7 tests pasando (sin regresión).
- **Migración Prisma**: ✅ generada con `--create-only`, revisado el SQL, aplicada con `prisma migrate deploy`, cliente regenerado con `prisma generate`. Prisma se mantiene en `6.19.3` — se ignoró deliberadamente el aviso de actualización a `8.0.0-rc.15` (regla del proyecto: no actualizar sin confirmación explícita).
- **Smoke test en vivo de `/body-metrics/*`** (servidor de desarrollo activo en `:3000`, usuario de prueba desechable, eliminado inmediatamente al terminar — 0 usuarios residuales verificado):
  - Estados vacíos correctos (`GET /body-metrics` → `[]`, `GET /body-metrics/latest` → vacío).
  - `POST /body-metrics` con y sin campos opcionales — ambos casos correctos.
  - `GET /body-metrics/latest` refleja la medición más reciente tras crear 2.
  - Validación: `weightKg: -5` → `400`.
  - Sin token → `401` en todos los endpoints.
  - `DELETE` exitoso → `200`; `DELETE` de un id inexistente → `404`.
  - **Ownership cruzado**: un segundo usuario intentando borrar la medición del primero → `403`.
- **`/progress-photos/*` sin `SUPABASE_SERVICE_ROLE_KEY` configurado**: falla de forma controlada (`500`, mensaje genérico sin fugar detalles internos) **sin tumbar el servidor** — confirmado con una llamada posterior exitosa a `/body-metrics/latest` inmediatamente después del fallo.

**No verificado en vivo** (bloqueado por falta de credenciales, no por un defecto de código): el flujo real de subida/lectura/borrado de fotos contra Supabase Storage. Pendiente para cuando se complete el paso manual de la sección 7.

## 7. Pendiente antes de poder usar `/progress-photos/*` en un entorno real

Dos pasos manuales, fuera del alcance de esta tarea (no son cambios de código):

1. **Crear el bucket `progress-photos` en Supabase Storage**, configurado como **privado**, con límite de tamaño de archivo.
2. **Copiar `SUPABASE_SERVICE_ROLE_KEY`** desde Supabase Dashboard → Project Settings → API → `service_role`, y pegarlo en `.env` (hoy vacío — placeholder dejado a propósito, no se fabricó ni adivinó un valor). `SUPABASE_URL` ya se completó, derivado correctamente del mismo proyecto que `DATABASE_URL`/`DIRECT_URL`.

Hasta que esto se complete, `/body-metrics/*` funciona con normalidad; `/progress-photos/*` devolverá `500` (comportamiento esperado y verificado, no un bug).

## 8. Siguiente paso

Semana 2 del roadmap de `docs/PHASE3_SPIKE.md`: implementación mobile (activar el shortcut "Cuerpo" en `evolucion/index.tsx`, pantalla de formulario + historial + `LineChart` reutilizado, flujo de subida de fotos) — no iniciada en esta tarea, según lo pedido explícitamente.
