# Módulo Entrenar — Estado del MVP

_Última actualización: 2026-09-24_

Primer módulo de negocio real de GymIA, construido a partir del análisis del archivo Figma "Final-Pro" (bloque de entrenamiento). Cubre el ciclo completo: crear rutina → iniciar sesión → registrar series → finalizar con resumen y detección de récords personales.

## Endpoints creados

Todos bajo `/workouts`, protegidos con `JwtAuthGuard` (requieren `Authorization: Bearer <token>`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/workouts/exercises` | Catálogo de ejercicios (compartido, no pertenece a un usuario) |
| GET | `/workouts/routines` | Rutinas del usuario autenticado |
| POST | `/workouts/routines` | Crear rutina (nombre + ejercicios con series/reps objetivo) |
| GET | `/workouts/sessions/active` | Sesión en curso del usuario, si existe |
| GET | `/workouts/sessions/:id` | Detalle de una sesión (verifica propiedad) |
| POST | `/workouts/sessions` | Iniciar sesión desde una rutina (bloquea si ya hay una en curso) |
| POST | `/workouts/sessions/:id/exercises/:sessionExerciseId/sets` | Agregar una serie extra a un ejercicio en curso |
| PATCH | `/workouts/sessions/:id/sets/:setLogId` | Actualizar peso/reps/completado de una serie |
| POST | `/workouts/sessions/:id/finish` | Finalizar sesión y calcular el resumen |

No se modificó `/auth/register` ni `/auth/login`.

## Modelos Prisma

6 tablas nuevas, todas con relación explícita a `User` (directa o vía `routineId`/`sessionId`), `onDelete: Cascade`:

- **`Exercise`** — catálogo compartido (nombre, grupo muscular)
- **`Routine`** — rutina de un usuario (`userId`)
- **`RoutineExercise`** — ejercicios de una rutina con orden y objetivo (series/reps)
- **`WorkoutSession`** — sesión de entrenamiento (`userId`, `routineId?`, `status`, `startedAt`, `finishedAt?`)
- **`WorkoutSessionExercise`** — ejercicios dentro de una sesión
- **`SetLog`** — cada serie registrada (peso, reps, completada, timestamp)

`User` solo ganó 2 campos de relación (`routines`, `workoutSessions`) — cero columnas nuevas en la tabla física, verificado antes y después de la migración.

**Nota técnica de la migración**: `User` nunca había pasado por `prisma migrate` (se creó con `init.sql` a mano). Se usó un baseline (`0_baseline`) para registrar el estado actual sin ejecutarlo, evitando que Prisma intentara resetear la base de datos.

## Pantallas Expo (Figma → código)

Todas bajo `src/app/(app)/entrenar/`, con el mismo sistema de diseño (dark, acento lima, Outfit/Geist) que Login/Register/Tabs:

| Pantalla | Archivo | Contenido |
|---|---|---|
| Dashboard | `index.tsx` | Saludo, banner de "entrenamiento en curso" si aplica, lista de rutinas con botón Iniciar, CTA "+ Nueva Rutina" |
| Nueva rutina | `new-routine.tsx` | Nombre, selección múltiple del catálogo de ejercicios, series/reps objetivo por ejercicio |
| Sesión activa | `session.tsx` | Cronómetro en vivo, progreso general, tabla de series por ejercicio (kg/reps/✓), agregar serie, stats en vivo (duración/volumen/series), finalizar |
| Resumen | `summary.tsx` | Trofeo, métricas (duración/series/volumen/récords), tarjeta de récords personales, volver |

## Flujo de usuario

```
Entrenar (dashboard)
  ├─ sin rutinas → "+ Nueva Rutina" → formulario → guarda → vuelve al dashboard
  ├─ con rutinas → tap "Iniciar" en una rutina
  │     └─ crea sesión (series pre-pobladas con el último peso usado, o 0 si es la primera vez)
  │         └─ Sesión activa: marcar series completadas (con peso/reps editables), agregar series extra
  │             └─ "Finalizar Entrenamiento" → calcula resumen → pantalla de Resumen
  │                 └─ "Volver a Entrenar" → dashboard (sin banner de sesión en curso)
  └─ con sesión en curso (ej. tras cerrar la app) → banner "Continuar entrenamiento" → retoma la sesión activa
```

## Verificaciones de seguridad y correctitud (realizadas en esta revisión)

1. **`JwtAuthGuard` en todas las rutas protegidas**: aplicado a nivel de controller (`@UseGuards(JwtAuthGuard)` en `WorkoutsController`), cubre las 9 rutas sin excepción. Confirmado con curl: sin token → `401`; con token válido → `200`.
2. **Todas las consultas filtran por usuario**:
   - `getRoutines`, `getActiveSession`: `where: { userId }` directo.
   - `getSession`: fetch por id + verificación explícita `session.userId !== userId` → `403 Forbidden` (necesario para distinguir 404 de 403).
   - `startSession`: verifica que la rutina pertenezca al usuario antes de crear la sesión.
   - `addSet`, `updateSet`, `finishSession`: todas pasan primero por `getSession`, heredando la verificación de propiedad.
   - Única excepción intencional: `getExercises()` — catálogo compartido, no pertenece a ningún usuario.
3. **Cálculo de récords personales**: por cada ejercicio de la sesión, se compara el peso máximo completado en *esta* sesión contra el peso máximo histórico completado por ese usuario en ese ejercicio (excluyendo la sesión actual). Se registra récord si no hay historial previo o si el nuevo peso es estrictamente mayor. Verificado en 3 escenarios reales (primera vez en un ejercicio, superar un récord anterior, no superarlo) vía curl y en la app.

## Limitaciones conocidas

- **Récord personal = peso máximo por serie completada**, sin considerar repeticiones (no es un cálculo real de 1RM). 100kg×1 siempre "gana" a 90kg×10.
- **Una sola sesión activa por usuario** — no se pueden entrenar dos rutinas en paralelo (decisión de diseño, no una limitación técnica).
- **Sin reordenar ni sustituir ejercicios en vivo** — el Figma lo muestra (drag handles, botón "Cambiar ejercicio"), pero está fuera del alcance MVP acordado.
- **Sin planificador semanal, adaptación por IA, heatmap de 90 días ni sparklines históricas** — recortado explícitamente del alcance de Figma por depender de datos de IA/wearables inexistentes en el backend.
- **La pantalla de Resumen recibe los datos vía parámro de navegación (JSON serializado en la URL)**, no vía un endpoint propio — funciona bien para el caso de uso actual (ver el resumen justo al finalizar) pero no permite volver a consultar el resumen de una sesión pasada sin recalcularlo.
- **`AppBackground` es una simplificación** del componente real de Figma (2 glows en vez de ~30 partículas + textura), documentado desde la Fase 1.
