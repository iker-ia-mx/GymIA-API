# Nutrición MVP — Estado de Implementación (Backend, Fase 1)

**Fecha:** 2026-09-24
**Alcance:** solo backend, siguiendo estrictamente `docs/NUTRITION_MVP_ROADMAP.md` y `docs/NUTRITION_TECHNICAL_PLAN.md`. **Sin cambios en `mobile/`.** Sin IA por foto, sin código de barras, sin offline sync, sin recomendaciones IA, sin integraciones externas — según lo pedido.

---

## 1. Migración Prisma

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
@@ model User @@
   routines        Routine[]
   workoutSessions WorkoutSession[]
   bodyMetrics     BodyMetric[]
   progressPhotos  ProgressPhoto[]
   refreshTokens   RefreshToken[]
+  foods           Food[]
+  meals           Meal[]
+  nutritionGoal   NutritionGoal?
 }

+model Food {
+  id           String   @id @default(uuid())
+  userId       String
+  name         String
+  caloriesKcal Float
+  proteinG     Float
+  carbsG       Float
+  fatG         Float
+  servingSizeG Float?
+  createdAt    DateTime @default(now())
+  updatedAt    DateTime @updatedAt
+
+  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
+  mealItems MealItem[]
+
+  @@index([userId])
+  @@index([userId, name])
+}
+
+model Meal {
+  id        String   @id @default(uuid())
+  userId    String
+  mealType  String
+  loggedAt  DateTime @default(now())
+  createdAt DateTime @default(now())
+
+  user  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
+  items MealItem[]
+
+  @@index([userId])
+  @@index([userId, loggedAt])
+}
+
+model MealItem {
+  id           String @id @default(uuid())
+  mealId       String
+  foodId       String
+  quantityG    Float
+  caloriesKcal Float
+  proteinG     Float
+  carbsG       Float
+  fatG         Float
+
+  meal Meal @relation(fields: [mealId], references: [id], onDelete: Cascade)
+  food Food @relation(fields: [foodId], references: [id])
+
+  @@index([mealId])
+  @@index([foodId])
+}
+
+model NutritionGoal {
+  id                String   @id @default(uuid())
+  userId            String   @unique
+  dailyCaloriesKcal Float
+  proteinG          Float?
+  carbsG            Float?
+  fatG              Float?
+  createdAt         DateTime @default(now())
+  updatedAt         DateTime @updatedAt
+
+  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
+}
```

Migración `prisma/migrations/20260924141333_add_nutrition_mvp/`, generada con `--create-only`, revisada antes de aplicar (solo `CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT` para las 4 tablas nuevas — **cero `ALTER`/`DROP` sobre tablas existentes**, mismo perfil de riesgo que todas las migraciones anteriores del proyecto). Aplicada con `prisma migrate deploy`, cliente regenerado.

**Confirmado**: `DailyNutritionSummary` y `BarcodeScan` **no se crearon** — tal como se especificó, el resumen diario se calcula en vivo (ver sección 4), siguiendo el mismo patrón ya validado en `EvolutionService`.

```
$ npx prisma migrate status
5 migrations found in prisma/migrations
Database schema is up to date!
```

**Corrección posterior (encontrada durante la verificación en vivo, ver sección 8): migración `20260924142430_meal_item_food_cascade_delete`.** La migración inicial dejó `MealItem.foodId → Food` con el comportamiento por defecto de Postgres (`ON DELETE RESTRICT`). Esto bloqueaba el cascade completo de `User` → `Food`/`Meal` → `MealItem` cuando un usuario tenía alimentos usados en comidas: `prisma.user.delete()` fallaba con una violación de FK cruda, imposibilitando borrar la cuenta de cualquier usuario con historial nutricional. Se corrigió a `onDelete: Cascade`:

```diff
-  food Food @relation(fields: [foodId], references: [id])
+  food Food @relation(fields: [foodId], references: [id], onDelete: Cascade)
```

```sql
-- DropForeignKey
ALTER TABLE "MealItem" DROP CONSTRAINT "MealItem_foodId_fkey";
-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Esto **no** afecta la regla de negocio de `DELETE /foods/:id` (sigue devolviendo `409` si el alimento está en uso — ese chequeo vive en el servicio, es independiente de la configuración de la base de datos). Solo cambia qué pasa cuando `Food` se borra como parte de un cascade más amplio (borrado de cuenta de usuario) en vez de un borrado individual vía la API — ahora sus `MealItem` se van con él, correcto porque en ese escenario todo el resto de los datos del usuario también está siendo eliminado.

## 2. Modelos creados

4 modelos nuevos: `Food`, `Meal`, `MealItem`, `NutritionGoal` — ver diff completo arriba. Relaciones añadidas a `User`: `foods`, `meals`, `nutritionGoal` (esta última `?` porque es 1 a 1, dado el `@unique` en `NutritionGoal.userId`).

**Decisión de diseño no explícita en el roadmap original, tomada durante la implementación**: `Food` es un catálogo **propio de cada usuario** (`userId` requerido, no un catálogo global como `Exercise`). Esto se decidió porque el propio enunciado de esta tarea pide `PATCH /foods/:id` y `DELETE /foods/:id` con validación de ownership — no tendría sentido pedir ownership sobre un catálogo compartido. Cada usuario construye su propio catálogo de alimentos desde cero.

**Convención de `servingSizeG`**: las macros de `Food` se definen "por cada `servingSizeG` gramos". Si se omite al crear el alimento, se asume el estándar de etiqueta nutricional: **por 100g**. Documentado en el DTO y en el servicio.

## 3. Endpoints creados

Todos bajo `@UseGuards(JwtAuthGuard)`, filtrados por `userId`, con verificación explícita de ownership antes de cualquier operación de escritura/lectura individual (mismo patrón fetch-then-compare de `WorkoutsService.getSession`).

| Método | Ruta | DTO | Descripción |
|---|---|---|---|
| `POST` | `/foods` | `CreateFoodDto` | Crea un alimento en el catálogo del usuario |
| `GET` | `/foods` | — | Lista los alimentos del usuario, orden alfabético |
| `GET` | `/foods/:id` | — | Detalle de un alimento (404/403 según corresponda) |
| `PATCH` | `/foods/:id` | `UpdateFoodDto` | Actualiza campos parciales |
| `DELETE` | `/foods/:id` | — | Elimina — **`409 Conflict`** si el alimento ya se usó en alguna comida (ver sección 5) |
| `POST` | `/meals` | `CreateMealDto` | Crea una comida vacía (tipo + fecha opcional) |
| `GET` | `/meals` | — | Lista las comidas del usuario con sus ítems, orden descendente por fecha |
| `GET` | `/meals/:id` | — | Detalle de una comida con sus ítems |
| `DELETE` | `/meals/:id` | — | Elimina la comida completa (sus ítems se van en cascada) — **añadido durante la verificación en vivo, ver sección 8** |
| `POST` | `/meals/:id/items` | `AddMealItemDto` | Añade un ítem a una comida existente (calcula el snapshot de macros) |
| `DELETE` | `/meals/:id/items/:itemId` | — | Elimina un ítem de una comida |
| `POST` | `/nutrition-goals` | `CreateNutritionGoalDto` | Crea o **actualiza** (upsert) el objetivo nutricional — ver nota abajo |
| `GET` | `/nutrition-goals/me` | — | Objetivo activo del usuario (`null` si no hay ninguno — estado vacío, no error) |
| `GET` | `/nutrition/summary/today` | — | Resumen del día actual: totales + objetivo, calculado en vivo |

14 endpoints — 13 de la lista original más `DELETE /meals/:id`, que faltaba en el enunciado de Semana 5 pero resultó necesaria para completar el CRUD de `Meal` (se puede crear/leer una comida pero, sin este endpoint, nunca borrarla entera) y para poder ejecutar la verificación end-to-end pedida.

**Nota de diseño**: la lista de endpoints pedida no incluye un endpoint de actualización dedicado para `NutritionGoal` (solo `POST` y `GET .../me`). Dado que `NutritionGoal.userId` es `@unique` (un objetivo activo por usuario), `POST /nutrition-goals` se implementó como **upsert** (`prisma.nutritionGoal.upsert`) — crea si no existe, reemplaza si ya existe. Es la única forma razonable de que el usuario pueda cambiar su objetivo con el conjunto de endpoints dado.

## 4. Agregación en vivo (`GET /nutrition/summary/today`)

Sin tabla materializada: `getTodaySummary` calcula el rango UTC del día actual (`[00:00:00, 24:00:00)`), trae las comidas del usuario en ese rango con sus ítems, y reduce sus macros en memoria — mismo patrón que `EvolutionService.computeWeeklyVolume`. El objetivo nutricional se trae en paralelo (`Promise.all`) y se incluye en la respuesta (`null` si no existe, sin lanzar error).

## 5. Seguridad y validación

- `JwtAuthGuard` en los 13 endpoints.
- Ownership verificado explícitamente en `Food` (crear ítem con un alimento ajeno → `403`), `Meal` (ver/añadir ítem/borrar ítem de una comida ajena → `403`), y de forma indirecta en `NutritionGoal` (siempre filtrado por `userId` del JWT, sin parámetro de id expuesto).
- `ValidationPipe` global aplica a los 5 DTOs nuevos.
- **Decisión de seguridad/integridad añadida durante la implementación**: `MealItem.foodId` usa `onDelete: RESTRICT` (default de Postgres) — Postgres rechazaría un `DELETE` de `Food` referenciado por algún `MealItem` con un error crudo de FK. Se decidió manejarlo explícitamente en el servicio: `deleteFood` cuenta las referencias antes de borrar y lanza `ConflictException` (`409`) con un mensaje claro si el alimento está en uso — nunca se deja que el error de base de datos llegue crudo al cliente.

## 6. Testing

`src/nutrition/nutrition.service.spec.ts` — 19 tests nuevos:
- **Food CRUD** (6): creación asociada al usuario, `NotFoundException`/`ForbiddenException` en `getFoodById`, actualización parcial correcta, borrado exitoso sin uso previo, `ConflictException` cuando el alimento está en uso.
- **Meal CRUD** (9): creación asociada al usuario, ownership en `getMealById`, **borrado de comida completa** (éxito y `ForbiddenException` — añadido junto con el endpoint `DELETE /meals/:id`), **cálculo de snapshot de macros según `servingSizeG`** (incluyendo el caso `servingSizeG: null` → asume 100g), `ForbiddenException` al añadir un alimento ajeno, borrado de ítem exitoso y `NotFoundException` si el ítem no pertenece a esa comida.
- **Daily summary** (4): suma correcta de macros a través de varias comidas, día vacío devuelve todo en cero sin error, inclusión del objetivo cuando existe, y verificación de que el filtro de fecha usa un rango UTC de 24 horas.

**Suite completa del proyecto**: pasó de 38 a **57 tests**, 5 archivos, 100% pasando.

## 7. Validación final

```
$ npm run build
> nest build
(sin errores)

$ npm run test
Test Files  5 passed (5)
     Tests  57 passed (57)

$ npm run lint
> oxlint --type-aware src/ test/
(sin errores ni warnings)
```

## 8. Verificación end-to-end en vivo

**Completada.** Se reinició el servidor de desarrollo (se encontraron y limpiaron 5 procesos `nest start --watch` acumulados de turnos anteriores de esta sesión, solo uno con un listener activo en `:3000` — se mataron todos y se arrancó uno limpio con `npm run start:dev`). Flujo verificado con un usuario de prueba desechable, eliminado al terminar:

| # | Petición | Resultado |
|---|---|---|
| 1 | `POST /foods` (Pechuga de pollo: 165kcal/31g P/0g C/3.6g G por 100g) | `201` — alimento creado correctamente |
| 1b | `POST /foods` (Manzana, para tener 2 alimentos) | `201` |
| 2 | `GET /foods` | `200` — lista con los 2 alimentos, orden alfabético correcto |
| 3 | `POST /meals` ×2 (una "comida", una "snack") | `201` en ambas, `items: []` por defecto |
| 4 | `POST /meals/:id/items` (150g de Pechuga en la comida 1) | `201` — snapshot calculado: `247.5 kcal, 46.5g P, 0g C, 5.4g G` (165×1.5, 31×1.5, 3.6×1.5 — correcto) |
| 4b | `POST /meals/:id/items` (100g de Manzana en la comida 2) | `201` — snapshot 1:1 con `servingSizeG=100` (correcto) |
| 5 | `GET /nutrition/summary/today` | `200` — `{totalCaloriesKcal: 299.5, totalProteinG: 46.8, totalCarbsG: 14, totalFatG: 5.6000000000000005, mealCount: 2, goal: null}` — suma de ambas comidas correcta (ver hallazgo menor abajo) |
| 6 | `DELETE /foods/:id` sobre Pechuga (en uso) | `409 Conflict` — correcto |
| 6b | `DELETE /foods/:id` sobre un tercer alimento nunca usado (Arroz blanco, creado ad hoc para la prueba) | `200` — correcto |
| 7 | `DELETE /meals/:id` sobre la comida 2 (snack con Manzana) | **`404` en el primer intento — endpoint no existía, ver Hallazgo 1.** Tras corregirlo: `200` |
| 8 | `GET /nutrition/summary/today` (tras borrar la comida 2) | `200` — `{totalCaloriesKcal: 247.5, totalProteinG: 46.5, totalCarbsG: 0, totalFatG: 5.4, mealCount: 1, goal: null}` — refleja solo la comida 1 restante, correcto |
| — | Verificación de integridad: `MealItem` huérfanos tras el `DELETE /meals/:id` | `0` en toda la tabla, confirmado por consulta directa |
| — | Limpieza: `prisma.user.delete()` del usuario de prueba | **Falló en el primer intento — violación de FK, ver Hallazgo 2.** Tras corregirlo: eliminado correctamente, las 4 tablas de Nutrición en `0` para ese usuario |

### Hallazgo 1 — `DELETE /meals/:id` no existía (endpoint faltante)

El enunciado original de Semana 5 solo pedía `DELETE /meals/:id/items/:itemId` (borrar un ítem), nunca "borrar la comida completa" — un CRUD incompleto para `Meal`. Al ejecutar el paso 7 de esta verificación (que sí pide explícitamente "eliminar una comida"), el endpoint no existía → `404`. **Corregido**: se añadió `deleteMeal` en el servicio (mismo patrón que `deleteFood`: ownership check + `prisma.meal.delete`, con `MealItem` yéndose en cascada) y `DELETE /meals/:id` en el controller, más 2 tests nuevos. Ver diff de endpoints en la sección 3.

### Hallazgo 2 — `MealItem.foodId` con `onDelete: RESTRICT` rompía el cascade de borrado de usuario

Más serio que el Hallazgo 1: al intentar limpiar el usuario de prueba al final de la verificación, `prisma.user.delete()` falló con una violación de FK cruda en `MealItem_foodId_fkey`. Causa: aunque `Food.userId` y `Meal.userId` tienen `onDelete: Cascade` desde `User`, `MealItem.foodId → Food` usaba el default de Postgres (`RESTRICT`) — cuando Postgres intenta cascadear el borrado de `Food` (vía `User`) mientras un `MealItem` todavía lo referencia, la restricción lo bloquea, y con ella bloquea el borrado completo del usuario. **Esto habría hecho imposible borrar la cuenta de cualquier usuario con al menos un alimento usado en una comida** — un bug de integridad real, no solo de esta sesión de pruebas. **Corregido**: migración `20260924142430_meal_item_food_cascade_delete`, cambia la relación a `onDelete: Cascade`. Verificado que la regla de negocio de `DELETE /foods/:id` (`409` si está en uso) sigue funcionando igual — esa validación vive en el servicio, no depende de la configuración de la base de datos. Ver detalle completo en la sección 1.

### Hallazgo menor — precisión de punto flotante en el resumen

`totalFatG: 5.6000000000000005` en vez de `5.6` (aritmética de punto flotante estándar de JavaScript, `1.2 + 4.4`-style). No es un bug funcional, pero debe redondearse antes de mostrarse (mismo patrón ya usado en `EvolutionService`: `Math.round(x * 10) / 10`). **No corregido en esta tarea** — es un ajuste de presentación, no de lógica de negocio, y esta tarea era de verificación, no de nueva implementación; queda como ítem para la siguiente iteración del servicio.

**Conclusión: el flujo vertical completo (crear alimento → listar → crear comida → agregar ítem → ver resumen → bloquear borrado en uso → borrar comida → resumen actualizado) queda validado end-to-end**, con 2 bugs reales encontrados y corregidos en el proceso, y un ajuste cosmético pendiente documentado.

## 9. Archivos creados/modificados

**Nuevos**
- `src/nutrition/nutrition.module.ts`
- `src/nutrition/nutrition.controller.ts`
- `src/nutrition/nutrition.service.ts`
- `src/nutrition/nutrition.service.spec.ts`
- `src/nutrition/dto/create-food.dto.ts`
- `src/nutrition/dto/update-food.dto.ts`
- `src/nutrition/dto/create-meal.dto.ts`
- `src/nutrition/dto/add-meal-item.dto.ts`
- `src/nutrition/dto/create-nutrition-goal.dto.ts`
- `prisma/migrations/20260924141333_add_nutrition_mvp/migration.sql`
- `prisma/migrations/20260924142430_meal_item_food_cascade_delete/migration.sql` — corrección del Hallazgo 2

**Modificados**
- `prisma/schema.prisma` — 4 modelos nuevos + 3 relaciones en `User`; `MealItem.foodId` corregido a `onDelete: Cascade`
- `src/app.module.ts` — registra `NutritionModule`
- `src/nutrition/nutrition.controller.ts` / `nutrition.service.ts` / `nutrition.service.spec.ts` — añadido `DELETE /meals/:id` (Hallazgo 1)

## 10. Siguiente paso

Mobile (fuera de esta tarea, según lo pedido): pantallas de Nutrición sobre este backend, siguiendo `docs/NUTRITION_MVP_ROADMAP.md` sección 6 (Mobile) y 7 (orden de implementación, tareas M1-M10). El backend queda completamente verificado end-to-end, sin bloqueantes conocidos.
