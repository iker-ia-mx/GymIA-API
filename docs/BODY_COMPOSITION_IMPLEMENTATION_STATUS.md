# Composición Corporal — Estado de Implementación

**Fecha:** 2026-09-24
**Alcance:** backend (Fase 1) + mobile (Semana 2, Fase 1), siguiendo `docs/BODY_COMPOSITION_DESIGN.md` y `docs/PHASE3_SPIKE.md`.

---

# Parte A — Backend

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

**Corrección aplicada durante la verificación mobile (Semana 2, ver Parte B):** `getProgressPhotos` construía el cliente de Storage (`getStorageBucket()`) de forma **incondicional**, incluso con 0 fotos — por lo que `GET /progress-photos` devolvía `500` para cualquier usuario sin fotos, en vez de `[]`. Corregido con un `if (photos.length === 0) return [];` antes de tocar Storage. Este bug no fue detectado en el smoke test de esta Parte A porque nunca se probó `GET /progress-photos` en estado vacío — solo se probó `POST /progress-photos/upload-url`, que sí depende de Storage legítimamente. Ver Parte B, sección "Bugs encontrados y corregidos".

## 7. Pendiente antes de poder usar `/progress-photos/*` en un entorno real

Dos pasos manuales, fuera del alcance de esta tarea (no son cambios de código):

1. **Crear el bucket `progress-photos` en Supabase Storage**, configurado como **privado**, con límite de tamaño de archivo.
2. **Copiar `SUPABASE_SERVICE_ROLE_KEY`** desde Supabase Dashboard → Project Settings → API → `service_role`, y pegarlo en `.env` (hoy vacío — placeholder dejado a propósito, no se fabricó ni adivinó un valor). `SUPABASE_URL` ya se completó, derivado correctamente del mismo proyecto que `DATABASE_URL`/`DIRECT_URL`.

Hasta que esto se complete, `/body-metrics/*` funciona con normalidad; `/progress-photos/*` devolverá `500` (comportamiento esperado y verificado, no un bug).

## 8. Siguiente paso (al cierre de la Parte A)

Semana 2 del roadmap de `docs/PHASE3_SPIKE.md`: implementación mobile — completada, ver Parte B.

---

# Parte B — Mobile (Semana 2, Fase 1)

**Alcance:** experiencia móvil para `BodyMetric` y `ProgressPhoto` consumiendo el backend de la Parte A. **Sin cambios en Nutrición, sin IA, sin offline sync** — según lo pedido.

## 1. Pantallas creadas

| Pantalla | Archivo | Ruta |
|---|---|---|
| Body Composition Home | `src/app/(app)/evolucion/cuerpo.tsx` | `/evolucion/cuerpo` |
| Add Body Metric | `src/app/(app)/evolucion/cuerpo-agregar.tsx` | `/evolucion/cuerpo-agregar` |
| Progress Photos Gallery | `src/app/(app)/evolucion/cuerpo-fotos.tsx` | `/evolucion/cuerpo-fotos` |
| Add Progress Photo | `src/app/(app)/evolucion/cuerpo-agregar-foto.tsx` | `/evolucion/cuerpo-agregar-foto` |

Rutas planas dentro de `evolucion/` (no en una subcarpeta `cuerpo/`), replicando exactamente el patrón ya usado por `strength.tsx` — consistente con la arquitectura de Expo Router del proyecto.

## 2. Archivos creados

- `src/app/(app)/evolucion/cuerpo.tsx`
- `src/app/(app)/evolucion/cuerpo-agregar.tsx`
- `src/app/(app)/evolucion/cuerpo-fotos.tsx`
- `src/app/(app)/evolucion/cuerpo-agregar-foto.tsx`
- `src/lib/bodyCompositionApi.ts` — cliente API (8 funciones: `getBodyMetrics`, `getLatestBodyMetric`, `createBodyMetric`, `deleteBodyMetric`, `getProgressPhotos`, `createUploadUrl`, `registerProgressPhoto`, `deleteProgressPhoto`, `uploadPhotoToStorage`)

## 3. Archivos modificados

- `src/app/(app)/evolucion/index.tsx` — activa el shortcut "Cuerpo" (`enabled: true`) y corrige un bug preexistente: todos los shortcuts habilitados navegaban a `/evolucion/strength` sin importar cuál se tocara (el `onPress` estaba hardcodeado). Se añadió un campo `route` por shortcut.
- `app.json` — añade el plugin `expo-image-picker` con textos de permiso de cámara/galería.
- `package.json` / `package-lock.json` — nueva dependencia `expo-image-picker@~57.0.20` (instalada con `npx expo install`, versión resuelta automáticamente para el SDK del proyecto).

## 4. Métricas mostradas

Peso, % Grasa Corporal, Masa Muscular, Cintura — las 4 disponibles en el backend, en 4 tarjetas (grid 2×2) en el Home. Cada tarjeta muestra el valor más reciente y, si existe una medición previa con ese mismo campo, un delta (`+`/`-`). El delta **no se colorea como "bueno"/"malo"**: sin conocer el objetivo del usuario (bajar de peso vs. ganar masa), asumir una dirección sería incorrecto — decisión de diseño documentada inline en el código.

## 5. Gráficas

- Reutiliza el componente `LineChart` existente de Evolución **sin modificarlo**.
- Timeline histórica de peso: un punto por medición, mismo patrón de `useMemo` + etiquetas de fecha corta (`formatWeekLabel`) que `strength.tsx`.
- Último valor destacado: encabezado de la tarjeta del gráfico ("Peso — 78.4 kg" + "Última medición: Hoy/Ayer/Hace N días").

## 6. Fotos

Flujo de 3 pasos implementado en `cuerpo-agregar-foto.tsx` + `bodyCompositionApi.ts`, exactamente como se diseñó en `BODY_COMPOSITION_DESIGN.md`:

1. `createUploadUrl(token, contentType)` → `POST /progress-photos/upload-url`.
2. `uploadPhotoToStorage(uploadUrl, fileUri, contentType)` → `fetch(uploadUrl, { method: 'PUT', body: blob })` **directo a Supabase Storage**, sin pasar por la API de GymIA (por eso esta función no usa `apiRequest`).
3. `registerProgressPhoto(token, storagePath)` → `POST /progress-photos`.

Selector de imagen: `expo-image-picker`, con `requestMediaLibraryPermissionsAsync`/`requestCameraPermissionsAsync` antes de abrir cada picker, y mensaje de error explícito si el permiso está bloqueado (mismo patrón de "acceso bloqueado, actívalo en ajustes" visto en el Figma de Nutrición).

## 7. Estados implementados

| Pantalla | Loading | Empty | Error |
|---|---|---|---|
| Home | `ActivityIndicator` mientras carga historial + fotos | Mensaje + CTA si no hay mediciones | Texto de error si falla la carga |
| Add Metric | Botón con `loading` mientras guarda | — (formulario siempre disponible) | Validación de peso + error de red |
| Gallery | `ActivityIndicator` | Mensaje si no hay fotos | Texto de error si falla la carga o el borrado |
| Add Photo | Botón con `loading` mientras sube | Placeholder "Elige una foto..." antes de seleccionar | Error de permiso (cámara/galería) separado del error de subida |

## 8. Arquitectura y reutilización

- Mismo patrón que Auth/Entrenar/Evolución: `useSession()` para el token, `apiRequest` como cliente HTTP base, `useFocusEffect` + `useCallback` para cargar datos al enfocar la pantalla (no `useEffect` crudo, por la regla de ESLint `react-hooks/set-state-in-effect` ya aplicada en el resto del proyecto).
- Componentes reutilizados sin modificar: `AppBackground`, `Card`, `PrimaryButton`, `TextField`, `LineChart`.
- `theme/tokens.ts` sin cambios — cero colores/tipografías nuevos, todo tomado del sistema de diseño existente.
- Cero lógica de IA, cero sincronización offline — tal como se pidió explícitamente.

## 9. Bugs encontrados y corregidos (durante la verificación en navegador)

1. **Bug preexistente en `evolucion/index.tsx`** (no introducido en esta tarea, pero activado por ella): el `onPress` de los shortcuts estaba hardcodeado a `router.push('/evolucion/strength')` para *cualquier* shortcut habilitado. Con solo "Fuerza" habilitado no se notaba; al habilitar "Cuerpo" también, tocarlo habría navegado a la pantalla equivocada. Corregido añadiendo un campo `route` por shortcut.
2. **Bug real en el backend** (`BodyCompositionService.getProgressPhotos`): construía el cliente de Supabase Storage antes de comprobar si había fotos, causando `500` en `GET /progress-photos` para cualquier usuario sin fotos — es decir, para *todo* usuario nuevo. Encontrado navegando al Home de Composición Corporal con un usuario sin datos (justo el estado vacío que debía funcionar). Corregido con un early-return antes de tocar Storage. Ver Parte A, sección 6.
3. **Problema de UX en `cuerpo-agregar-foto.tsx`**: el cuadro de vista previa/placeholder (`aspectRatio: 1` al 100% de ancho) se volvía excesivamente alto en viewports anchos (build web de escritorio), empujando los botones fuera de pantalla sin hacer scroll. Corregido con `maxHeight: 360` además del `aspectRatio`.

## 10. Validación ejecutada

- **`npx tsc --noEmit`**: ✅ sin errores.
- **`npm run lint`** (`expo lint`): ✅ 0 errores, 2 warnings preexistentes sin relación (patrón oficial de Expo en `useStorageState.ts`, ya presentes antes de esta tarea).
- **Verificación en navegador** (Metro web, `localhost:8081`, usuario de prueba desechable — eliminado al terminar junto con un residuo de `evolution-empty-test@example.com` encontrado de una sesión previa a esta conversación, 0 usuarios/mediciones/fotos residuales confirmado):
  - Home con estado vacío → correcto.
  - Registrar medición completa (peso + 3 opcionales) → `201`, navegación de regreso correcta al entrar por el flujo real (Home → Agregar).
  - Home con datos reales → las 4 tarjetas, el gráfico con el punto correcto y la etiqueta de fecha, y la sección de fotos en estado vacío, todos coinciden con el diseño de Figma de `composicion-corporal`.
  - Galería de fotos en estado vacío → correcto.
  - Pantalla Agregar Foto → estructura, botones de selector y estado deshabilitado de "Subir Foto" (sin imagen seleccionada) verificados. **No se activaron los selectores nativos de cámara/galería** (abrirían diálogos del sistema operativo fuera del control de la sesión de automatización) — pendiente de probar en un simulador/dispositivo real.
- **`npm run build`** y **`npm run test`** del backend re-ejecutados tras el fix del bug de Storage: ✅ build limpio, 7/7 tests.

## 11. Pendiente / siguientes pasos

- Probar el flujo de subida de fotos de extremo a extremo en un simulador o dispositivo real (el picker de cámara/galería no se pudo ejercitar en el navegador).
- Sigue pendiente el paso manual de la Parte A, sección 7 (bucket de Storage + `SUPABASE_SERVICE_ROLE_KEY`) para que `/progress-photos/*` funcione más allá del estado vacío.
- No se agregó UI para `DELETE /body-metrics/:id` (la función ya existe en `bodyCompositionApi.ts` pero no está conectada a ninguna pantalla) — no estaba en el alcance de las 4 pantallas pedidas; considerar para una siguiente iteración si se quiere permitir corregir mediciones erróneas.
