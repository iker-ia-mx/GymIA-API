# Composición Corporal — Diseño Técnico (Semana 1 de Fase 3)

**Fecha:** 2026-09-24
**Tipo de documento:** diseño técnico previo a implementación. **Sin cambios de código** — este documento es la base para la revisión antes de tocar `schema.prisma` o escribir el módulo.
**Contexto:** Semana 1 del roadmap definido en `docs/PHASE3_SPIKE.md` (backend + diseño de datos de Composición Corporal). Sigue el mismo patrón arquitectónico ya validado en Entrenar y Evolución: relación explícita con `User` desde el día uno, `JwtAuthGuard` en todos los endpoints, filtrado por usuario, sin dejar nada "pendiente" para después.

---

## 1. Schema Prisma propuesto

```prisma
model BodyMetric {
  id         String   @id @default(uuid())
  userId     String
  recordedAt DateTime @default(now())
  weightKg   Float
  bodyFatPct Float?
  leanMassKg Float?
  waistCm    Float?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, recordedAt])
}

model ProgressPhoto {
  id          String   @id @default(uuid())
  userId      String
  storagePath String
  contentType String   @default("image/jpeg")
  takenAt     DateTime @default(now())
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, takenAt])
}
```

**Decisiones que se apartan del boceto de `PHASE3_SPIKE.md` (justificadas):**
- `weightKg` pasa de opcional a **requerido**: es la única métrica que cualquier usuario puede registrar con solo una báscula; el resto (`bodyFatPct`, `leanMassKg`, `waistCm`) requiere equipo adicional (báscula de bioimpedancia, cinta métrica) y se mantiene opcional, igual que en el Figma ("Registrar Nueva Medición" no exige las 4 métricas a la vez).
- `storageUrl` se reemplaza por `storagePath`: con un bucket **privado** de Supabase Storage (ver sección 7), no existe una URL pública permanente que guardar — se guarda la ruta del objeto y las URLs firmadas de lectura se generan al vuelo en cada request.
- Se añade `contentType` en `ProgressPhoto`: necesario para servir el archivo con las cabeceras correctas al generar la URL firmada de lectura.
- Se añade `createdAt` en ambos modelos, separado de `recordedAt`/`takenAt`: permite distinguir "cuándo ocurrió la medición/foto" (dato del usuario, editable/backfill) de "cuándo se registró en el sistema" (auditoría), mismo patrón que ya existe implícitamente en `WorkoutSession` (`startedAt` vs. creación de fila).

## 2. Relaciones con `User`

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())

  routines        Routine[]
  workoutSessions WorkoutSession[]
  bodyMetrics     BodyMetric[]
  progressPhotos  ProgressPhoto[]
}
```

Ambos modelos nuevos siguen exactamente el patrón ya establecido: relación directa y explícita a `User` (no "pendiente"), `onDelete: Cascade` para que un borrado de usuario elimine automáticamente sus mediciones y fotos sin dejar huérfanos — el mismo mecanismo que ya se verificó funciona correctamente al limpiar los usuarios de prueba de Evolución.

## 3. Índices y constraints

| Modelo | Índice/constraint | Razón |
|---|---|---|
| `BodyMetric` | `@@index([userId])` | Filtrado base por usuario (todas las queries lo requieren) |
| `BodyMetric` | `@@index([userId, recordedAt])` | Acceso principal es "historial de un usuario ordenado por fecha" — el índice compuesto cubre el `WHERE userId = ? ORDER BY recordedAt` sin escaneo adicional |
| `ProgressPhoto` | `@@index([userId])` | Igual que arriba |
| `ProgressPhoto` | `@@index([userId, takenAt])` | Mismo patrón, para listar fotos ordenadas cronológicamente (comparación "más reciente vs. seleccionada") |

**Sin `@@unique` en ninguno de los dos modelos**, deliberadamente: el Figma no restringe la frecuencia de registro ("Registrar Nueva Medición" no impide más de una entrada por día), y forzar unicidad por día introduciría fricción de producto no solicitada. Si en el futuro se necesita "una medición oficial por semana" para el gráfico de tendencia, esa es una decisión de agregación en la capa de servicio (ver sección 8 de riesgos), no una constraint de base de datos.

## 4. DTOs necesarios

Seguendo el mismo patrón de `class-validator` usado en `dto/create-routine.dto.ts` y `dto/update-set.dto.ts`:

```typescript
// dto/create-body-metric.dto.ts
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateBodyMetricDto {
  @IsNumber()
  @Min(1)
  weightKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bodyFatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leanMassKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waistCm?: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string; // permite backfill de una medición de un día anterior; por defecto, ahora
}
```

```typescript
// dto/create-photo-upload-url.dto.ts
import { IsIn, IsOptional } from 'class-validator';

export class CreatePhotoUploadUrlDto {
  @IsOptional()
  @IsIn(['image/jpeg', 'image/png'])
  contentType?: string; // default: 'image/jpeg'
}
```

```typescript
// dto/register-progress-photo.dto.ts
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterProgressPhotoDto {
  @IsString()
  @MinLength(1)
  storagePath!: string; // devuelto por POST /body-metrics/photos/upload-url

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
```

No se necesita un DTO de actualización (`Update*`) para ninguno de los dos recursos en el MVP — a diferencia de `SetLog` (que se actualiza en vivo mientras se completa una serie), una medición o foto de progreso es un registro histórico: si el usuario se equivoca, la acción esperada es borrar y volver a crear, no editar in situ (ver endpoints `DELETE` en la sección 5).

## 5. Endpoints REST

Todos bajo `@UseGuards(JwtAuthGuard)` a nivel de controller, filtrados por `userId` vía `@CurrentUser()` — mismo patrón que `WorkoutsController`/`EvolutionController`.

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| `GET` | `/body-metrics` | — | Historial de mediciones del usuario, orden descendente por `recordedAt` |
| `POST` | `/body-metrics` | `CreateBodyMetricDto` | Registra una nueva medición |
| `DELETE` | `/body-metrics/:id` | — | Elimina una medición (verifica ownership antes de borrar) |
| `POST` | `/body-metrics/photos/upload-url` | `CreatePhotoUploadUrlDto` | Genera una URL firmada de **subida** (TTL corto) + la `storagePath` que el cliente deberá registrar después |
| `POST` | `/body-metrics/photos` | `RegisterProgressPhotoDto` | Registra en la base de datos una foto ya subida exitosamente al storage |
| `GET` | `/body-metrics/photos` | — | Lista las fotos del usuario, cada una con una URL firmada de **lectura** (TTL más largo) generada en el momento |
| `DELETE` | `/body-metrics/photos/:id` | — | Elimina una foto: primero el objeto en Storage, luego la fila en base de datos (ver riesgo en sección 8) |

7 endpoints — 3 más que el boceto original de `PHASE3_SPIKE.md` (que tenía 4): se añadieron `POST /body-metrics/photos/upload-url` (necesario para el flujo de subida directa a Storage, ver sección 7) y los dos `DELETE` (resuelven explícitamente el riesgo de privacidad de fotos ya identificado en el spike — "¿el usuario puede borrar sus fotos?" — la respuesta de este diseño es sí, desde el MVP).

## 6. Casos de uso Mobile

1. **Entrada al módulo**: el usuario toca el shortcut "Cuerpo" en `evolucion/index.tsx` — ya existe reservado (`{ key: 'cuerpo', enabled: false }`), solo se activa (`enabled: true`) y se enruta a la nueva pantalla.
2. **Estado vacío**: sin mediciones previas, se muestra un CTA "Registrar Nueva Medición" (mismo patrón de estado vacío ya usado en Evolución).
3. **Registrar medición**: formulario con `weightKg` requerido, los otros 3 campos opcionales y claramente marcados como tales — evita fricción para el usuario que solo tiene una báscula simple.
4. **Ver historial + tendencia**: lista de mediciones pasadas + gráfico de línea de peso en el tiempo, reutilizando el componente `LineChart` ya construido para Evolución sin cambios.
5. **Registrar foto de progreso** (flujo de 3 pasos, ver sección 7):
   - Seleccionar de galería o tomar foto (`expo-image-picker`).
   - App pide una URL de subida al backend, sube el archivo directo a Supabase Storage.
   - App confirma el registro contra el backend.
6. **Comparar fotos**: seleccionar dos fotos del historial (por defecto: más reciente vs. la más antigua) y mostrarlas lado a lado — mismo layout que el diseño de Figma ("Hace 1 mes" / "Hoy").
7. **Eliminar medición o foto**: acción explícita del usuario (ej. swipe-to-delete o botón en el detalle), con confirmación antes de ejecutar — dato sensible/irreversible.
8. **Manejo de errores**:
   - Permiso de cámara/galería denegado → mensaje + enlace a ajustes del sistema (patrón ya visto en el Figma de Nutrición, "Acceso Denegado a Cámara" — mismo componente reutilizable).
   - Fallo de red durante la subida a Storage → no se debe llamar a `POST /body-metrics/photos` hasta confirmar que la subida fue exitosa, evitando así filas en base de datos sin archivo real detrás.
   - `weightKg` fuera de rango o vacío → validación en cliente antes de enviar, más el `400` que ya devuelve el `ValidationPipe` global si se evade.

## 7. Estrategia de almacenamiento de fotos

**Decisión: subida directa a Supabase Storage vía URL firmada, no proxy a través del backend NestJS.**

Flujo:
1. Mobile llama `POST /body-metrics/photos/upload-url` → el backend genera una `storagePath` única (`{userId}/{uuid}.jpg`) y solicita a Supabase Storage una **URL de subida firmada** (`createSignedUploadUrl`, TTL corto, ej. 5 minutos) para esa ruta en un bucket dedicado `progress-photos`.
2. Mobile sube el binario **directamente** a esa URL (`PUT`), sin pasar por el servidor NestJS.
3. Mobile llama `POST /body-metrics/photos` con la `storagePath` recibida, confirmando el registro en Prisma.
4. Al listar (`GET /body-metrics/photos`), el backend genera una **URL de lectura firmada** (`createSignedUrl`, TTL más largo, ej. 1 hora) por cada foto, verificando primero que la fila pertenece al usuario autenticado — nunca se devuelve ni almacena una URL pública permanente.

**Por qué este enfoque y no subir el archivo al backend (multipart + Multer):**
- El servidor NestJS nunca maneja bytes de imagen — menor uso de memoria/ancho de banda, sin necesidad de configurar límites de payload para archivos grandes.
- Es el patrón recomendado por Supabase para este caso exacto y evita construir infraestructura de proxy de archivos desde cero.
- Mantiene el backend enfocado en autorización y metadata, consistente con cómo ya se diseñó el resto del proyecto (Prisma como única fuente de verdad de datos estructurados).

**Seguridad**: el bucket debe crearse como **privado** (no público). Dado que este proyecto no usa Supabase Auth ni sus políticas RLS (la autenticación es JWT custom, ver `docs/STATUS.md`), el control de acceso a las fotos se aplica **enteramente en la capa NestJS**: la URL de subida solo se emite para la `storagePath` derivada del `userId` del JWT, y la URL de lectura solo se genera tras verificar que la fila `ProgressPhoto` pertenece a ese mismo `userId` — mismo modelo de autorización que ya protege cada fila de Postgres.

**Validación**: `contentType` restringido a `image/jpeg`/`image/png` vía el DTO (`@IsIn`); límite de tamaño de archivo (ej. 8MB) se aplica en la configuración del bucket de Supabase Storage, no en el backend (que nunca ve el archivo).

## 8. Riesgos técnicos

- **El cascade de Prisma/Postgres no toca Supabase Storage.** Si se borra un `User` (o una `ProgressPhoto`) directamente en la base de datos, la fila desaparece pero el archivo en el bucket **queda huérfano** — a diferencia de todo lo demás en este proyecto, este es el primer caso donde el estado vive partido entre dos sistemas. El servicio de `ProgressPhoto` debe borrar explícitamente el objeto en Storage **antes** de borrar la fila en `DELETE /body-metrics/photos/:id`, y cualquier futuro endpoint de borrado de cuenta de usuario deberá hacer lo mismo para todas sus fotos antes de dejar que el cascade de Postgres actúe. Este riesgo debe verificarse explícitamente en pruebas, con la misma disciplina de "cero huérfanos" ya aplicada al limpiar los datos de prueba de Evolución.
- **Múltiples mediciones por día sin regla de agregación definida.** El gráfico de tendencia semanal necesitará una regla (¿la más reciente de la semana? ¿un promedio?) antes de implementarse — se recomienda reutilizar el mismo criterio que `EvolutionService.computeWeeklyVolume`/`getExerciseHistory` (el valor más reciente/mejor dentro del bucket semanal), por consistencia con el resto de la app, y decidirlo explícitamente antes de escribir el servicio, no durante.
- **Datos 100% auto-reportados**, sin integración de básculas/wearables (fuera de alcance, ya descartado desde Fase 2) — no hay forma técnica de validar que `weightKg` o `bodyFatPct` sean correctos; es un límite de producto conocido, no un bug a resolver.
- **Sensibilidad de las fotos de progreso.** Son imágenes corporales del usuario — dato personal sensible. Este proyecto no tiene hoy un flujo de consentimiento explícito ni política de privacidad formal; la mitigación técnica (bucket privado + URLs firmadas + verificación de ownership) reduce el riesgo de exposición pero no sustituye una decisión de producto/legal sobre cómo comunicar al usuario qué se hace con estas fotos.
- **URLs firmadas de lectura con expiración.** Si la app mantiene una URL en caché más allá de su TTL (ej. 1 hora), la imagen dejará de cargar — mitigado regenerando las URLs en cada `GET /body-metrics/photos`, pero hay que evitar cachear la URL misma en el cliente por más tiempo que su TTL.

## 9. Plan de migración

1. Añadir los dos modelos nuevos (`BodyMetric`, `ProgressPhoto`) y las dos relaciones nuevas en `User` a `schema.prisma` — **sin tocar ningún modelo existente**, mismo patrón de bajo riesgo que la migración `20260924030830_add_workout_module`.
2. Ejecutar `npx prisma migrate dev --name add_body_composition_module` contra `DIRECT_URL` (no `DATABASE_URL`, por la incompatibilidad ya conocida del pooler de Supabase con `prisma migrate`).
3. Revisar el SQL generado antes de confirmar — debe contener únicamente `CREATE TABLE` para las dos tablas nuevas y sus índices/FKs, cero `ALTER`/`DROP` sobre tablas existentes.
4. Regenerar el cliente Prisma (`prisma generate`, normalmente automático tras `migrate dev`).
5. **Paso manual fuera de Prisma**: crear el bucket `progress-photos` en Supabase Storage, configurarlo como **privado**, y definir el límite de tamaño de archivo a nivel de bucket. Esto no se versiona en `schema.prisma` — documentar el paso en el README o en un script de setup para que no dependa de memoria humana.
6. Verificar en un entorno de prueba (mismo patrón usado para auditar Evolución): crear un usuario de prueba, registrar mediciones y una foto, confirmar cascade de borrado correcto (incluyendo el objeto en Storage), y **eliminar el usuario de prueba al terminar** — no repetir el hallazgo de datos residuales de la auditoría de Evolución.

## 10. Checklist de implementación

**Backend**
- [ ] Modelos `BodyMetric` y `ProgressPhoto` + relaciones en `User` añadidos a `schema.prisma`
- [ ] Migración generada, revisada y aplicada (`add_body_composition_module`)
- [ ] Bucket `progress-photos` creado en Supabase Storage (privado, límite de tamaño configurado)
- [ ] `dto/create-body-metric.dto.ts`, `dto/create-photo-upload-url.dto.ts`, `dto/register-progress-photo.dto.ts`
- [ ] `BodyCompositionService` (o `BodyMetricsService`): CRUD de mediciones + lógica de generación de URLs firmadas de subida/lectura + borrado explícito en Storage antes del borrado en base de datos
- [ ] `BodyCompositionController`: 7 endpoints, `@UseGuards(JwtAuthGuard)`, filtrado por `userId` en cada query
- [ ] `BodyCompositionModule`: importa `AuthModule`, se registra en `app.module.ts` (mismo patrón que `WorkoutsModule`/`EvolutionModule`)
- [ ] Verificación explícita de ownership antes de cualquier `DELETE` o generación de URL de lectura
- [ ] Tests unitarios del servicio desde el día uno (no diferir, como sí ocurrió con `WorkoutsService`/`EvolutionService` — deuda ya documentada en `NEXT_STEPS.md`)
- [ ] `npm run build` sin errores

**Frontend (mobile — diseño ya cubierto, implementación en Semana 2 del roadmap)**
- [ ] Activar el shortcut `Cuerpo` en `evolucion/index.tsx` (`enabled: true`)
- [ ] Pantalla de formulario de medición + historial + `LineChart` reutilizado
- [ ] Flujo de subida de foto (selección → upload-url → subida directa → registro)
- [ ] Comparación de 2 fotos lado a lado
- [ ] Manejo de estados vacíos, errores de permiso de cámara/galería, y fallos de subida

**Verificación final**
- [ ] Prueba end-to-end en vivo (registro, listado, borrado, cascade sin huérfanos — incluyendo Storage)
- [ ] Limpieza de cualquier usuario/dato de prueba creado durante la verificación
- [ ] `docs/BODY_COMPOSITION_MVP_STATUS.md` (mismo formato que `EVOLUTION_MVP_STATUS.md`)
