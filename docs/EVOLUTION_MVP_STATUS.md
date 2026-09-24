# Evolución — Estado del MVP

**Fecha de auditoría:** 2026-09-24
**Módulo:** Evolución (Fase 2, backend `src/evolution/` + frontend `mobile/src/app/(app)/evolucion/`)
**Alcance MVP:** Puntuación de progreso, récords recientes (14 días), volumen semanal, y 1RM estimado con historial por ejercicio (gráfico de línea SVG). Explícitamente fuera de alcance: Composición Corporal, score "IA" real, wearables, integraciones externas.

---

## Funcionalidades implementadas

- **Dashboard de Evolución General** (`evolucion/index.tsx`): puntuación de progreso (0–100%), resumen de sesiones de los últimos 7 días, atajos a módulos de análisis (solo "Fuerza" habilitado; el resto queda deshabilitado visualmente para fases futuras), lista de récords recientes (ventana de 14 días).
- **Fuerza y Rendimiento** (`evolucion/strength.tsx`): selector de ejercicios (chips), gráfico de evolución del 1RM estimado por semana (`LineChart` con `react-native-svg`), volumen total semanal con delta vs. semana anterior, listado de hitos (1RM actual) por ejercicio principal.
- **Cálculo de 1RM estimado**: fórmula de Epley (`peso * (1 + reps/30)`) aplicada sobre series completadas (`completed: true`).
- **Agregación semanal**: bucketing por semana ISO (lunes UTC) para volumen y tendencia de 1RM.
- **Puntuación de progreso**: fórmula transparente (no es un modelo de IA) que combina frecuencia de entrenamiento (60%) y tendencia de volumen (40%), documentada en el propio código.

## Endpoints disponibles

Todos protegidos con `JwtAuthGuard` y filtrados por `userId` extraído del JWT (`req.user.id`). Verificado en vivo que las 3 rutas devuelven `401 Unauthorized` sin token.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/evolution/summary` | Puntuación de progreso, sesiones últimos 7 días, récords recientes (14 días) |
| `GET` | `/evolution/strength` | Volumen semanal (actual y delta), lista de ejercicios con 1RM estimado actual |
| `GET` | `/evolution/strength/:exerciseId` | Historial semanal de 1RM estimado para un ejercicio específico, con `percentChange` |

## Flujo completo de datos

1. El usuario completa series (`SetLog.completed = true`) dentro de sesiones de entrenamiento del módulo Entrenar (`WorkoutSession` → `WorkoutSessionExercise` → `SetLog`).
2. `EvolutionService.getCompletedSets(userId)` consulta todas las series completadas del usuario vía relación `sessionExercise.session.userId`, ordenadas por `completedAt`.
3. A partir de ese conjunto base, cada endpoint deriva su propia proyección en memoria (sin nuevas tablas ni columnas desnormalizadas):
   - `getSummary` → récords recientes (máximo peso por ejercicio dentro de 14 días) + tendencia de volumen semanal.
   - `getStrengthOverview` → mejor 1RM estimado por ejercicio (histórico completo) + volumen semanal actual/anterior.
   - `getExerciseHistory` → mejor 1RM estimado por semana para un ejercicio, ordenado cronológicamente, con `percentChange` entre el primer y último punto.
4. El frontend consume estos endpoints vía `src/lib/evolutionApi.ts`, tipado end-to-end (`RecentRecord`, `StrengthOverview`, `ExerciseHistory`).
5. La navegación entre ejercicios en "Fuerza y Rendimiento" dispara una nueva consulta a `/evolution/strength/:exerciseId`; un guard por `useRef` garantiza que solo la respuesta de la última selección se pinte, incluso si una respuesta anterior llega tarde.

## Hallazgos de la auditoría

Verificados los 8 puntos solicitados:

| Punto auditado | Resultado |
|---|---|
| Exactitud de métricas | Verificado en vivo con datos reales: 1RM (Epley), volumen semanal (Σ peso×reps) y récords recientes coinciden exactamente con el cálculo manual esperado (ver sección de regresión abajo). |
| Consistencia visual con Figma | Correcta tras corrección del subtítulo de "Fuerza y Rendimiento" (faltaba "avanzadas"). Resto de textos, colores y tipografía (`theme/tokens`) consistentes. |
| Rendimiento del gráfico SVG | `LineChart` envuelto en `React.memo`; `chartPoints` memoizado con `useMemo` en `strength.tsx` — evita recálculo/rerender del SVG en cambios de estado no relacionados. |
| Responsividad | `Svg` usa `viewBox` + `preserveAspectRatio="none"` sobre un canvas virtual (320×height), por lo que escala correctamente a cualquier ancho de pantalla sin recalcular coordenadas. |
| Persistencia de datos | Confirmada: los datos provienen directamente de `SetLog` vía Prisma/Supabase, sin caché ni estado intermedio — sobreviven a recargas y cambios de sesión. |
| Estados vacíos | Verificado en vivo con un usuario sin historial: `/evolution/summary` devuelve `progressScore: 20, recentRecords: []` sin error; `/evolution/strength` devuelve `exercises: []`. El frontend muestra mensajes vacíos apropiados ("Sin récords...", "Completa series..."). |
| Casos sin historial (por ejercicio) | Verificado en vivo: un ejercicio nunca entrenado por el usuario devuelve `{exerciseName: null, history: [], percentChange: 0}` sin error 500; el `LineChart` renderiza su estado vacío ("Todavía no hay suficientes datos"). |
| Errores de navegación | Guard de "última solicitud gana" (`latestRequestedExerciseId` con `useRef`) evita que una respuesta tardía de un ejercicio previamente seleccionado sobrescriba el gráfico tras cambiar de chip. |

## Bugs encontrados

1. **Claves de lista frágiles**: `key={record.exerciseName}` en "Récords Recientes" — dos ejercicios con el mismo nombre (o cambios de nombre) podían colisionar claves de React.
2. **Condición de carrera al cambiar de ejercicio**: en `strength.tsx`, seleccionar un ejercicio y luego otro antes de que resolviera la primera petición podía hacer que la respuesta más lenta sobrescribiera el gráfico del ejercicio ya seleccionado.
3. **Re-render innecesario del gráfico SVG**: `chartPoints` se recalculaba en cada render y `LineChart` no estaba memoizado, causando trabajo de layout SVG redundante en cambios de estado no relacionados (p. ej. `isLoadingOverview`).
4. **Desviación menor de fidelidad con Figma**: el subtítulo de "Fuerza y Rendimiento" decía "Analíticas de tus levantamientos principales" en vez de "Analíticas **avanzadas** de tus levantamientos principales".

## Bugs corregidos

Los 4 bugs anteriores fueron corregidos y verificados:

1. Se añadió `exerciseId: string` como primer campo de `RecentRecord` (backend `computeRecentRecords` y tipo frontend `RecentRecord`); `evolucion/index.tsx` ahora usa `key={record.exerciseId}`.
2. Se añadió `latestRequestedExerciseId` (`useRef<string | null>`) en `strength.tsx`; cada callback de `loadHistory` (`then`/`catch`/`finally`) comprueba que la petición sigue siendo la más reciente antes de tocar el estado.
3. Se memoizó `chartPoints` con `useMemo` (dependencia: `history`) y se envolvió `LineChartComponent` en `React.memo`, exportado como `LineChart`.
4. Se corrigió el subtítulo a "Analíticas avanzadas de tus levantamientos principales".

**Verificación de regresión (post-fix), en vivo contra la API real:**

- Usuario de prueba nuevo sin historial → estados vacíos correctos en `/evolution/summary` y `/evolution/strength`, sin errores.
- Rutina + sesión con 2 ejercicios (Aperturas con Mancuernas, Curl de Bíceps), series completadas con pesos distintos:
  - `/evolution/strength` devolvió `exerciseId` en cada entrada y 1RM correctos: Aperturas 57.0 kg (esperado: 45×(1+8/30)=57.0), Curl 23.3 kg (esperado: 17.5×(1+10/30)=23.33).
  - `/evolution/strength/:exerciseId` devolvió historiales aislados y correctos por separado para cada `exerciseId`, confirmando que el backend nunca mezcla datos entre ejercicios (precondición del fix de condición de carrera en el cliente).
  - `/evolution/summary` devolvió `recentRecords` con `exerciseId` presente y pesos máximos correctos (45 kg y 17.5 kg).
  - Volumen semanal (`weeklyVolumeKg: 1115`) coincide exactamente con `totalVolumeKg` devuelto por `POST /workouts/sessions/:id/finish` (40×10 + 45×8 + 15×12 + 17.5×10 = 1115).
- Las 3 rutas de Evolución devuelven `401` sin token JWT.
- `npm run build` compila sin errores tras los fixes.

## Riesgos pendientes

- **Sin caché ni paginación**: `getCompletedSets` trae *todas* las series completadas del usuario en cada request de cualquiera de los 3 endpoints. Aceptable para el volumen de datos de un MVP, pero escalará mal con usuarios de larga trayectoria (años de historial). No es necesario resolverlo ahora, pero conviene vigilarlo.
- **`progressScore` es una heurística simple**, no validada con usuarios reales — puede necesitar ajuste de pesos (60/40) una vez haya datos de uso real.
- **`percentChange` con un solo punto de historial** siempre es `0` (no hay "antes" con qué comparar) — comportamiento esperado, pero vale la pena confirmarlo con el equipo de producto si se espera otro mensaje para ese caso en vez de "0%".
- **Usuario de prueba de la verificación de regresión** (`evolution-audit-*@example.com`) quedó en la base de datos de Supabase — no se eliminó porque no existe endpoint de borrado de usuario ni se pidió acceso directo a la base de datos en esta sesión. Si se desea limpiar, requiere una acción explícita (borrado directo en Supabase o vía Prisma Studio).

## Checklist MVP

- [x] Puntuación de progreso funcional y transparente (fórmula documentada, no "IA" simulada)
- [x] Récords recientes con ventana de 14 días
- [x] Volumen semanal actual + delta vs. semana anterior
- [x] 1RM estimado (Epley) por ejercicio, histórico completo y por semana
- [x] Gráfico de línea SVG sin dependencias externas (`react-native-svg` únicamente)
- [x] Todos los endpoints protegidos con `JwtAuthGuard` y filtrados por usuario
- [x] Estados vacíos manejados (sin historial general, sin historial por ejercicio)
- [x] Responsividad del gráfico (viewBox + preserveAspectRatio)
- [x] Consistencia visual con Figma
- [x] Compila sin errores (`npm run build`)
- [ ] Limpieza del usuario de prueba de la verificación de regresión (pendiente, requiere acción explícita)

## Próximos pasos recomendados

1. **Fase 3 — Nutrición**: siguiente módulo de negocio según el plan de Fase 2 original, pendiente de infraestructura de visión/IA y base de datos de alimentos antes de poder arrancar.
2. **Explorar Composición Corporal** (actualmente fuera de alcance) como extensión natural de Evolución una vez validado el MVP actual con usuarios reales.
3. **Revisar la fórmula de `progressScore`** con datos de uso real; considerar hacerla configurable o basada en objetivos del usuario en vez de una ponderación fija.
4. **Monitorizar el volumen de `getCompletedSets`** a medida que crezca el historial de usuarios; si se vuelve un problema de rendimiento, considerar agregaciones precalculadas o paginación por rango de fechas.
5. **Confirmar con producto** el mensaje deseado para `percentChange` cuando solo existe un punto de historial.
