# Nutrición MVP — Roadmap y Backlog de Implementación

**Fecha:** 2026-09-24
**Tipo de documento:** planificación ejecutable, previa a implementación. **Sin código.**
**Construye sobre:** `docs/NUTRITION_TECHNICAL_PLAN.md` (Semana 4) — este documento recorta ese plan completo a un MVP deliberadamente más pequeño, según instrucción explícita: **sin IA por foto, sin escaneo de código de barras, sin offline sync, sin recomendaciones IA**.

---

## 1. Recomendación final de arquitectura para este MVP

El plan técnico completo (`NUTRITION_TECHNICAL_PLAN.md`) diseñaba 6 tablas y 13 endpoints pensando en el módulo completo (incluyendo IA de visión y escaneo de código de barras). Con esas dos piezas fuera de alcance, la arquitectura se simplifica de forma real, no solo se "pospone":

- **`BarcodeScan` no se crea** — no tiene ningún consumidor sin la función de escaneo. No es deuda técnica dejarla fuera; es la tabla correcta cuando esa fase exista, no antes.
- **`DailyNutritionSummary` no se crea** — mismo argumento ya hecho en el plan técnico: se calcula en vivo (patrón ya validado en `EvolutionService`), y a este volumen (sin IA ni escaneo generando registros en cascada) hay aún menos motivo para materializarla ahora.
- **`Food` se simplifica**: sin `barcode`, sin `brand`, sin `fiberG`/`sugarG`/`sodiumMg` — esos campos existen para dar contexto a productos empaquetados escaneados, que no son parte de este MVP. Quedan: `name`, macros base, `servingSizeG` de referencia, `source` (solo `"manual"` por ahora).
- **`Meal` se simplifica**: sin `source` (solo hay un origen: manual) ni `photoPath` (sin fotos).
- **Resultado: 4 tablas nuevas** (`Food`, `Meal`, `MealItem`, `NutritionGoal`), no 6. Añadir `barcode`/`brand`/`source` extendido a `Food`, o las tablas `BarcodeScan`/`DailyNutritionSummary`, en una fase posterior es una migración aditiva simple — no hay costo de re-trabajo por dejarlas fuera ahora.
- **Sin integraciones externas** — cero dependencias nuevas (nada de Claude Vision, Open Food Facts, USDA, Supabase Storage). Esto es la simplificación más importante: convierte a Nutrición MVP en el módulo de menor riesgo técnico construido hasta ahora en GymIA, comparable en complejidad a Composición Corporal sin fotos.

---

## 2. Alcance exacto del MVP

### Entra

| Funcionalidad | Detalle |
|---|---|
| Registro manual de alimentos | Buscar en el catálogo propio (`Food`) o crear uno nuevo con sus macros; registrar una cantidad (gramos) dentro de una comida |
| Objetivos calóricos | Un objetivo activo por usuario: calorías diarias |
| Macronutrientes | Objetivo opcional de proteína/carbohidratos/grasa; desglose por comida y por día |
| Historial diario | Ver comidas registradas de cualquier día pasado |
| Resumen diario | Totales del día (calorías + macros) contra el objetivo, calculado en vivo |

### NO entra (explícitamente excluido)

- **IA por fotografía** — sin `POST /nutrition/vision/analyze`, sin integración con ningún proveedor de visión.
- **Escaneo de código de barras** — sin `POST /nutrition/barcode/scan`, sin integración con Open Food Facts/USDA/FatSecret, sin tabla `BarcodeScan`.
- **Offline sync** — sin `expo-sqlite`, sin cola de sincronización, sin resolución de conflictos. La app requiere conexión, igual que el resto de GymIA hoy.
- **Recomendaciones IA** ("Nutria IA" generando dietas, correlación con Entrenar) — ninguna lógica de recomendación, solo registro y visualización de lo que el usuario ingresa.

## 3. Dependencias técnicas

- **Ninguna dependencia externa nueva** — ni paquete npm nuevo en `api`, ni en `mobile` (no hace falta `expo-camera`/`expo-barcode-scanner`, ya que no hay escáner en este MVP).
- Reutiliza en su totalidad la infraestructura ya existente: Prisma/Postgres, `JwtAuthGuard`, `ValidationPipe` global, patrón de módulo NestJS (`module`/`service`/`controller`/`dto`), y en mobile: `apiRequest`, `useSession`, `useFocusEffect`, `Card`/`PrimaryButton`/`TextField`/`LineChart`.
- Única dependencia real: que `AuthModule` siga exportando `JwtAuthGuard` (ya lo hace, sin cambios necesarios).

## 4. Riesgos

- **UX de registro manual con fricción**: sin código de barras ni foto, cada comida requiere buscar o crear un alimento a mano — es el riesgo de producto más relevante de este MVP recortado (ya señalado en `NUTRITION_SPIKE.md`: "un MVP recortado compite directamente con apps existentes sin ninguna ventaja"). Mitigación parcial: sembrar el catálogo `Food` con ~30-50 alimentos comunes (huevo, pollo, arroz, tortilla, frijoles, etc. — mismo patrón que el seed de 15 ejercicios de Entrenar) para que no todos los usuarios empiecen desde cero.
- **Expectativa de producto vs. lo entregado**: el Figma explorado en fases anteriores muestra un ecosistema mucho más rico (IA, escáner, recetas) — comunicar claramente que este MVP es una base funcional, no el diseño completo, para no generar expectativas equivocadas en el equipo o en usuarios de prueba.
- **Un solo objetivo activo por usuario** (`@unique` en `userId`): si en el futuro se quiere versionar objetivos en el tiempo (para medir adherencia histórica contra el objetivo vigente en cada momento), este esquema requeriría un cambio de modelo, no solo una migración aditiva — riesgo menor, documentado para no sorprender más adelante.
- **Snapshot de macros en `MealItem`**: correcto por diseño (evita que corregir un alimento reescriba el historial), pero significa que corregir un error en `Food` no corrige retroactivamente comidas ya registradas con el valor erróneo — comportamiento esperado, pero debe comunicarse si surge como pregunta de soporte.

## 5. Estimación por semanas

| Semana | Alcance |
|---|---|
| **5** | Backend completo: schema, migración, DTOs, servicio, 9 endpoints, tests unitarios, seed de alimentos comunes |
| **6** | Mobile: las 5 pantallas, navegación, cliente API, conexión completa al backend, verificación end-to-end en vivo |

**2 semanas**, no 4 — la mitad del tiempo estimado en el plan técnico completo, consecuencia directa de excluir IA/escaneo/offline. Semanas 7-8 (originalmente reservadas para escáner + cámara IA) quedan libres para la siguiente prioridad del roadmap general del proyecto.

---

## 6. Backlog técnico

### Backend

#### Prisma
| # | Tarea | Complejidad |
|---|---|---|
| B1 | Modelo `Food` (name, caloriesKcal, proteinG, carbsG, fatG, servingSizeG?, source, createdAt) | S |
| B2 | Modelo `Meal` (userId, mealType, loggedAt, createdAt) + relación `User.meals` | S |
| B3 | Modelo `MealItem` (mealId, foodId, quantityG, snapshot de macros) + índices en `mealId`/`foodId` | S |
| B4 | Modelo `NutritionGoal` (`userId` único, dailyCaloriesKcal, macros opcionales) + relación `User.nutritionGoal` | S |
| B5 | Generar migración (`--create-only`), revisar SQL (debe ser solo `CREATE TABLE`, cero `ALTER` a tablas existentes), aplicar | S |
| B6 | Seed de ~30-50 alimentos comunes (`prisma/seed.mjs`, extendiendo el seed ya existente de ejercicios) | S |

#### DTOs
| # | Tarea | Complejidad |
|---|---|---|
| B7 | `CreateFoodDto` (name, caloriesKcal, proteinG, carbsG, fatG, servingSizeG opcional) | S |
| B8 | `CreateMealDto` (mealType, loggedAt opcional, `items: MealItemInputDto[]` con `@ValidateNested`/`@Type`/`@ArrayMinSize(1)` — mismo patrón que `CreateRoutineDto`) | M |
| B9 | `UpsertNutritionGoalDto` (dailyCaloriesKcal requerido, macros opcionales) | S |

#### Servicios (`NutritionService`)
| # | Tarea | Complejidad |
|---|---|---|
| B10 | `searchFoods(query)` — búsqueda simple por nombre (`contains`, case-insensitive) | S |
| B11 | `createFood(dto)` | S |
| B12 | `createMeal(userId, dto)` — crea `Meal` + `MealItem[]`, calculando el snapshot de macros a partir de `Food.caloriesKcal/proteinG/...` × `(quantityG / servingSizeG)` en el momento de creación | M |
| B13 | `getMeals(userId, date)` | S |
| B14 | `deleteMeal(userId, mealId)` — con verificación de ownership (mismo patrón `NotFoundException`/`ForbiddenException` de `WorkoutsService.getSession`) | S |
| B15 | `getGoal(userId)` / `upsertGoal(userId, dto)` | S |
| B16 | `getSummary(userId, date)` — agrega `MealItem` del día (en vivo, sin tabla materializada) | M |
| B17 | `getSummaryHistory(userId, days)` — mismo cálculo, agregado por día en un rango, para el gráfico de tendencia | M |

#### Endpoints (`NutritionController`)
| # | Ruta | Complejidad |
|---|---|---|
| B18 | `GET /nutrition/foods/search?q=` | S |
| B19 | `POST /nutrition/foods` | S |
| B20 | `POST /nutrition/meals` | S |
| B21 | `GET /nutrition/meals?date=` | S |
| B22 | `DELETE /nutrition/meals/:id` | S |
| B23 | `GET /nutrition/goals` | S |
| B24 | `PUT /nutrition/goals` | S |
| B25 | `GET /nutrition/summary?date=` | S |
| B26 | `GET /nutrition/summary/history?days=` | S |
| B27 | `NutritionModule` (importa `AuthModule`, se registra en `app.module.ts`) | S |
| B28 | Tests unitarios de `NutritionService` (mismo rigor que `WorkoutsService`/`EvolutionService`: cálculo de snapshot, agregación de resumen, ownership) | M |

### Mobile

#### Pantallas
| # | Pantalla | Ruta propuesta | Complejidad |
|---|---|---|---|
| M1 | Diario nutricional (reemplaza el `PlaceholderScreen` de `nutricion.tsx`) — comidas del día agrupadas por tipo, totales corriendo, CTA a registrar | `(app)/nutricion.tsx` | M |
| M2 | Registro manual (buscar/crear alimento + cantidad + tipo de comida) | `(app)/nutricion-agregar.tsx` | M |
| M3 | Historial de comidas (navegación por día) | `(app)/nutricion-historial.tsx` | M |
| M4 | Objetivos (formulario de calorías + macros) | `(app)/nutricion-objetivos.tsx` | S |
| M5 | Resumen diario (progreso vs. objetivo + desglose de macros + tendencia) | `(app)/nutricion-resumen.tsx` | M |

#### Componentes
| # | Tarea | Complejidad |
|---|---|---|
| M6 | `src/lib/nutritionApi.ts` — cliente API (9 funciones, mismo patrón que `bodyCompositionApi.ts`) | S |
| M7 | Componente de barra/progreso de calorías vs. objetivo — reutilizar el patrón `View`+ancho porcentual ya usado en `evolucion/index.tsx` (`scoreBarTrack`/`scoreBarFill`), no una librería nueva | S |
| M8 | Resto de UI: `Card`, `PrimaryButton`, `TextField`, `LineChart` — **reutilizados sin modificar** | — |

#### Navegación
| # | Tarea | Complejidad |
|---|---|---|
| M9 | Activar `(app)/nutricion.tsx` como pantalla real (hoy es `PlaceholderScreen`) — el tab ya existe en `(app)/_layout.tsx`, no requiere cambios de navegación de tabs | S |
| M10 | Enlaces internos entre las 5 pantallas (`router.push`), mismo patrón plano ya usado en `evolucion/cuerpo-*.tsx` | S |

---

## 7. Orden de implementación recomendado

1. **B1–B6** (Prisma completo + seed) — todo lo demás depende del schema.
2. **B7–B9** (DTOs) — rápido, desbloquea servicios y controller en paralelo conceptual.
3. **B10, B11, B15** (servicios simples: búsqueda, creación de alimento, objetivo) — sin lógica de agregación todavía, valor rápido para poder probar el resto.
4. **B12, B13, B14** (creación/lectura/borrado de comidas) — el corazón del MVP.
5. **B16, B17** (resúmenes) — dependen de que ya existan comidas reales para verificar el cálculo.
6. **B18–B27** (controller + módulo) — cablea todo lo anterior; puede hacerse incrementalmente junto con cada servicio en vez de al final, si se prefiere verificar endpoint por endpoint.
7. **B28** (tests) — en paralelo a B10-B17, no al final (mismo criterio ya aplicado en el sprint de deuda técnica: escribir tests junto con el servicio, no diferidos).
8. **Verificación en vivo del backend completo** (mismo patrón de auditoría de Entrenar/Evolución/Composición Corporal) antes de tocar mobile.
9. **M6** (cliente API) — primer paso de mobile, sin él ninguna pantalla puede conectar.
10. **M4** (Objetivos) — la pantalla más simple, buen primer punto de integración real mobile↔backend.
11. **M2** (Registro manual) — la pantalla central del flujo.
12. **M1** (Diario nutricional) — depende de que ya se puedan crear comidas (M2) para tener datos que mostrar.
13. **M5** (Resumen diario) — depende de M1/M2 con datos reales para verificar cálculos y visualización.
14. **M3** (Historial) — la de menor urgencia relativa, mismo patrón de lista que M1 pero sobre días pasados.
15. **M7, M9, M10** — en paralelo a las pantallas que los usan, no como tareas aisladas.
16. **Verificación end-to-end final** + `docs/NUTRITION_MVP_STATUS.md`.

Este orden prioriza tener, lo antes posible, un ciclo completo verificable (crear alimento → registrar comida → ver resumen) sobre completar una capa entera (todo el backend, o todas las pantallas) antes de probar nada end-to-end — mismo criterio que evitó sorpresas tardías en los módulos anteriores de GymIA.
