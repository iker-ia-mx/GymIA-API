# Motor de Adherencia — Arquitectura Técnica

**Fecha:** 2026-09-25
**Motivo:** confirmado como bloqueador en 4 lugares del proyecto (Evolución, Escuadrón Hub, Escuadrón Perfil de Miembro, Achievements) — ver `docs/EVOLUTION_REMAINING_SPEC.md` §Gaps, `docs/ACHIEVEMENTS_PRODUCT_SPEC.md` §7, `docs/ESCUADRON_PRODUCT_SPEC.md` §13. Documento de solo diseño — sin código, sin migraciones, sin commits.

---

## 1. Definición formal de adherencia

**Adherencia = el grado en que el usuario cumple el plan de entrenamiento que él mismo declaró**, medido como el porcentaje de días de entrenamiento planeados en los que efectivamente completó al menos una sesión, dentro de una ventana de tiempo.

Es deliberadamente **relativa al propio plan del usuario, no a un estándar externo**: `OnboardingProfile.trainingDays` (ya existe, subset de `["L","M","X","J","V","S","D"]`, capturado en el cuestionario de onboarding) es la única fuente de verdad sobre "qué días se supone que entrena esta persona". Un usuario que declaró 2 días/semana y los cumple tiene 100% de adherencia — no se le compara contra alguien que declaró 5. Esto evita inventar un estándar universal de "cuánto se debería entrenar" que no existe en ningún lugar del producto.

**Explícitamente fuera de esta definición (ver §12):** adherencia a Sueño o Nutrición (ninguno de los dos módulos tiene un concepto de "cantidad esperada" tan claro como `trainingDays` — Sueño además está bloqueado por la limitación de HealthKit ya documentada), y cualquier comparación contra otros usuarios ("92% de tu grupo de peso" en el diseño de Achievements) — ambas son extensiones especulativas que requieren decisiones de producto propias, no parte de este motor.

## 2. Eventos que contribuyen a la adherencia

Un solo tipo de evento, ya existente y sin ambigüedad:

- **Sesión de entrenamiento completada** — `WorkoutSession` con `status = "completed"` y `finishedAt` no nulo, cuyo `finishedAt` cae en un día calendario que es uno de los `trainingDays` declarados por el usuario.

Reglas derivadas:
- Varias sesiones el mismo día cuentan como **1 día cumplido** (no hay crédito extra por entrenar dos veces).
- Una sesión en un día que **no** está en `trainingDays` (un "día extra") **no suma ni resta** — mide si el usuario cumplió lo que planeó, no si hizo más de lo planeado. Evita que "hacer trampa" entrenando en exceso un solo día compense días planeados incumplidos.
- Sesiones `in_progress` o `abandoned` **no cuentan** — mismo criterio que ya usa `EvolutionService.getSummary` para `sessionsLast7Days`.
- Días futuros dentro de la ventana (todavía no han ocurrido) **no cuentan como incumplidos** — solo se evalúan días ya transcurridos (ver §9).

## 3. Fórmula de cálculo propuesta

```
plannedDays(window)   = días calendario dentro de `window` cuyo día de la semana
                         está en OnboardingProfile.trainingDays, Y que ya transcurrieron
                         (fecha ≤ hoy)
completedDays(window) = subconjunto de plannedDays(window) que tiene ≥1 WorkoutSession
                         con status="completed" y finishedAt ese mismo día calendario

adherencePct = plannedDays.length === 0
  ? null   // sin plan declarado, o ningún día planeado transcurrido todavía
  : round(completedDays.length / plannedDays.length * 100)
```

Fórmula transparente, aritmética simple — **no es un modelo de IA**, mismo principio ya documentado para `progressScore` en `EvolutionService.getSummary`.

**Ventana (`window`) por defecto:** mes calendario actual (día 1 del mes hasta hoy), porque así lo muestra el diseño de Achievements ("Adherencia este Mes") y es la granularidad más útil para un resumen de perfil. La función se diseña genérica sobre cualquier rango de fechas — el mismo cálculo sirve para una vista semanal futura (el "Calendario Semanal" de `evolucion-error-adherencia`, ver §10) sin duplicar lógica.

## 4. Modelos Prisma requeridos

**Ninguno.** Todo el cálculo se deriva en el momento de la consulta a partir de datos que ya existen:
- `OnboardingProfile.trainingDays` (el plan)
- `WorkoutSession.status` + `WorkoutSession.finishedAt` (el cumplimiento)

Esto es deliberado, no un descuido — coherente con "reducir deuda de producto en vez de seguir construyendo pantallas aisladas": no se persiste nada nuevo, no hay migración, no hay tabla que pueda desincronizarse de la fuente real. El volumen de datos por usuario (sesiones de entrenamiento a lo largo de meses) es lo bastante pequeño para que una consulta en vivo sea barata — mismo criterio ya usado por `getStrengthOverview` y `computeRecentRecords`, que escanean todo el historial de `SetLog` sin tabla de caché.

**Alternativa considerada y descartada para el MVP:** una tabla `AdherenceDay` materializada (un registro por usuario/día con snapshot de "planeado"/"cumplido"). Se descarta porque introduce trabajo de sincronización (¿cuándo se escribe? ¿qué pasa si se recalcula el pasado?) sin necesidad real a este volumen de datos. Queda documentada como opción de Fase posterior si en algún momento se necesita precisión histórica exacta ante cambios de plan (ver §7, §12).

## 5. Cambios de backend

- **Nuevo `AdherenceService`** (`src/adherence/adherence.service.ts`), con dos métodos:
  - `getAdherence(userId: string, window?: { start: Date; end: Date }): Promise<{ percentage: number | null; plannedDays: number; completedDays: number; windowStart: Date; windowEnd: Date }>` — por defecto, mes calendario actual.
  - `getCurrentStreak(userId: string): Promise<number>` — ver fórmula en §8.
- **Nuevo `AdherenceModule`**, exportando `AdherenceService` — mismo patrón que `EvolutionModule`. Se importa donde haga falta (Evolution, Squad), igual que Squad ya importa `EvolutionModule` para reutilizar `getStrengthOverview`. **Ninguna lógica de adherencia se duplica en otro servicio** — es la misma disciplina de "una sola costura reutilizada" ya aplicada a `SquadAccessService`.
- **Nuevo endpoint** `GET /evolution/adherence` en `EvolutionController` (`@UseGuards(JwtAuthGuard)`, `@CurrentUser()`) — devuelve el resultado de `getAdherence(user.id)`.
- **`SquadService.getMemberProfile`**: agrega `adherencePercentage` al objeto devuelto, llamando a `AdherenceService.getAdherence(targetUserId)` **después** de que `assertSharedSquad` autorice — mismo patrón ya usado para `EvolutionService.getStrengthOverview`. Esto reabre una decisión ya tomada en el MVP aprobado de Escuadrón (`docs/ESCUADRON_PRODUCT_SPEC.md` §13 excluyó explícitamente "Adherencia Promedio") — **requiere aprobación explícita separada antes de tocar código de Escuadrón**, no se asume aquí.
- **`SquadMembership.streakDays`**: hoy es un campo inerte (existe en el esquema, nunca se escribe). Con el motor de adherencia, deja de necesitarse como columna persistida — se recomienda que `SquadService` deje de leer esa columna para mostrarla y en su lugar llame a `AdherenceService.getCurrentStreak(userId)` en vivo, igual que XP ya se documentó como "recalculado de forma diferida" en la arquitectura original de Escuadrón. La columna puede quedarse en el esquema sin uso (limpieza de schema, no urgente) o retirarse en una migración aparte más adelante.
- **Tests**: `adherence.service.spec.ts` nuevo, cubriendo la fórmula, ventana parcial (usuario nuevo a mitad de mes), sin plan declarado, sesiones no completadas, días extra fuera del plan, y el cálculo de racha.

## 6. Cambios de mobile

- Nueva función `getAdherence(token)` en `src/lib/evolutionApi.ts` (mismo archivo que ya expone `getStrengthOverview`), tipada como `{ percentage: number | null; plannedDays: number; completedDays: number; windowStart: string; windowEnd: string }`.
- **`perfil/progreso-logros.tsx`** (ya existe, de la etapa de Achievements): agregar la tarjeta "Adherencia este Mes" que se omitió explícitamente en esa etapa — ahora sí es real, sin inventar nada. La comparación "92% de tu grupo de peso" sigue sin implementarse (gap separado, no resuelto por este motor).
- **Escuadrón** (`miembro/[userId].tsx`, `index.tsx` del Hub): agregar adherencia/racha real **solo si se aprueba explícitamente reabrir ese alcance** (ver §5) — no se incluye por defecto en el MVP de este documento.
- **Evolución**: el motor desbloquea el *número* de adherencia, no la pantalla `evolucion-error-adherencia` completa — ver alcance exacto en §10.

## 7. Historial y recalculación

- **Sin historial persistido en el MVP.** Cada consulta recalcula en vivo sobre la ventana pedida — no hay "recalcular" como acción explícita, porque no hay nada cacheado que pueda quedar desactualizado. Completar una sesión, o corregir datos de una sesión pasada, se refleja inmediatamente la próxima vez que se pide el número.
- **Limitación documentada, no resuelta en el MVP:** el cálculo siempre usa el `OnboardingProfile.trainingDays` **actual**, no el que estaba vigente en el momento histórico consultado. Si un usuario cambia su plan de 3 a 5 días/semana, una consulta sobre un mes pasado evaluará ese mes pasado contra el plan de 5 días, aunque en ese momento solo hubiera declarado 3 — puede subestimar la adherencia histórica real. Se documenta explícitamente en vez de resolverse porque solucionarlo bien requiere una tabla de versiones del plan (`OnboardingProfile` no tiene historial, solo el estado actual) — ver Fase posterior en §12.
- Ventanas más allá del mes actual (p. ej. "los últimos 6 meses") son técnicamente soportadas por la misma función (el approach por rango de fechas es genérico) pero no se exponen en ningún endpoint del MVP — no hay ninguna pantalla que las necesite todavía.

## 8. Rachas

**Racha actual** (única métrica de racha en el MVP): número de días planeados consecutivos, contando hacia atrás desde hoy, que se cumplieron sin interrupción — se detiene en el primer día planeado incumplido.

```
streak = 0
día = hoy
mientras día es un trainingDay Y día ya transcurrió completamente:
  si hay una WorkoutSession completada ese día → streak += 1, retroceder al trainingDay anterior
  si no → detener el conteo
(días que no son trainingDay se saltan sin romper ni sumar la racha)
```

"Hoy" solo se evalúa si el día ya "cerró" en la práctica (para no penalizar a alguien que todavía tiene tiempo de entrenar hoy) — se define como: si hoy es un `trainingDay` sin sesión completada todavía, no rompe la racha hasta que empiece un nuevo día; si hoy ya tiene una sesión completada, sí suma.

**Explícitamente fuera del MVP:** racha más larga histórica (`longest streak`), y notificaciones de "racha perdida" (el diseño de `evolucion-error-adherencia` muestra "Racha de 12 días perdida" como un evento detectado) — eso requiere lógica de detección de eventos (cuándo exactamente se "rompió"), no solo un cálculo bajo demanda. Se documenta como Fase posterior (§12).

**Reemplaza a `SquadMembership.streakDays`**, que queda como columna inerte sin uso activo (ver §5).

## 9. Excepciones y casos límite

| Caso | Comportamiento |
|---|---|
| Usuario sin `OnboardingProfile` o `trainingDays` vacío | `percentage: null` — nunca 0% ni 100%, para no insinuar un dato que no existe |
| Usuario recién registrado, ventana parcialmente transcurrida | Solo cuentan los días planeados que ya pasaron dentro de la ventana — un usuario registrado el miércoles no es juzgado por lunes/martes, ni por los días futuros de la semana |
| Varias sesiones completadas el mismo día | Cuenta como 1 día cumplido, no acumula |
| Sesión completada un día fuera del plan declarado | No suma ni resta adherencia (ver §2) |
| Sesión `in_progress` o `abandoned` | No cuenta como cumplimiento |
| Usuario cambia `trainingDays` a mitad de la ventana actual | El cálculo usa el valor vigente al momento de la consulta para toda la ventana — ver limitación documentada en §7 |
| Zona horaria | Los "días calendario" se calculan en UTC, mismo criterio que `getWeekStart` ya usa en `EvolutionService` — hereda la misma limitación ya existente en el proyecto (un usuario en una zona horaria muy distinta a UTC podría ver un día calendario desplazado); no es un problema nuevo de este motor, no se resuelve aquí |

## 10. Impacto por módulo

| Módulo | Qué se desbloquea | Qué sigue sin desbloquearse |
|---|---|---|
| **Evolución** | El número de adherencia en sí (ej. una tarjeta simple nueva en el dashboard) | La pantalla completa `evolucion-error-adherencia` sigue bloqueada: "Racha de 12 días perdida" (notificación de evento), "Completar Ayer" (registro retroactivo, no existe), calendario cruzado con Sueño/Nutrición (agregación multi-módulo, no existe), "Apple Health/Google Fit Desconectado" (sync de wearables para entrenamiento, no existe) — ver `docs/EVOLUTION_REMAINING_SPEC.md` |
| **Escuadrón Hub** | `SquadMembership.streakDays` deja de estar inerte — puede mostrarse real | "Meta Semanal Colectiva" (kcal quemadas grupalmente) sigue sin resolver — es una métrica de grupo distinta, no adherencia individual |
| **Escuadrón Perfil de Miembro** | "Adherencia Promedio" se vuelve técnicamente construible | **Requiere reabrir una decisión de alcance ya aprobada** (`docs/ESCUADRON_PRODUCT_SPEC.md` §13 la excluyó explícitamente del MVP) — no se activa automáticamente solo porque el motor exista |
| **Achievements (Progreso y Logros)** | "Adherencia este Mes" se vuelve real, completando la sección que se omitió en esa etapa | La comparación "92% de tu grupo de peso" (percentil entre usuarios) sigue fuera — requiere una decisión de producto propia sobre cohortes, no resuelta por este motor |

## 11. MVP

- `AdherenceModule`/`AdherenceService` con `getAdherence` (ventana = mes actual por defecto, genérica sobre cualquier rango) y `getCurrentStreak`.
- `GET /evolution/adherence` nuevo endpoint.
- Tests unitarios de la fórmula y sus casos límite.
- Mobile: `getAdherence()` en `evolutionApi.ts` + tarjeta real en `perfil/progreso-logros.tsx`.
- **Cero modelos Prisma nuevos, cero migraciones.**
- Cambios en Escuadrón (Perfil de Miembro, Hub) **fuera del MVP de este documento** — requieren aprobación de alcance separada, ver §10.

## 12. Fases posteriores

1. **Precisión histórica ante cambios de plan** — tabla de versiones de `trainingDays` (o snapshot ligero por semana/mes) para que la adherencia histórica refleje el plan vigente en cada momento, no el actual.
2. **Racha más larga histórica + detección de "racha perdida"** — requiere lógica de eventos (detectar el momento exacto en que se rompió una racha activa), no solo cálculo bajo demanda.
3. **Adherencia multi-dominio** (Nutrición vía `MealScheduleEntry`, ya tiene un concepto real de "horario esperado"; Sueño solo cuando se resuelva el gap de HealthKit/dev-client nativo).
4. **Comparación entre usuarios** ("grupo de peso" u otra cohorte) — requiere decidir qué es una cohorte y cómo se calcula el percentil.
5. **Adherencia agregada de Escuadrón** ("Meta Semanal Colectiva" u otra métrica de grupo) — distinta del streak/adherencia individual ya cubierto aquí.
6. **Recalculación adaptativa del plan** ("Recalcular Plan" del diseño de Figma) — implica un motor de ajuste de rutina, fuera de alcance de un motor de medición.
