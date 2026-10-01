# S4-ProgressAchievements — Especificación de Producto

**Fecha:** 2026-09-25
**Nodo Figma:** `142:6022` ("Progreso y Logros"), fileKey `O4cXfRJ7qCbKuH3Jdon00k`
**Fuente:** diseño real traído de Figma en este turno (no investigación previa) + `docs/FINAL_PARITY_PRIORITY.md` (estimación previa, corregida aquí) + `EvolutionService` ya existente.

---

## Veredicto explícito (lo que se pidió confirmar antes de implementar)

**No, no todo el contenido de la pantalla son hitos verificables.** El diseño mezcla tres tipos de contenido con estatus muy distinto:

| Sección | ¿Hito verificable? | Por qué |
|---|---|---|
| **Récords Personales (PRs)** | ✅ Sí | Dato real, ya calculado por `EvolutionService.getStrengthOverview` (1RM estimado por la fórmula de Epley), reutilizado sin cambios desde Etapa 2 de Escuadrón. Solo falta exponer la fecha del récord (dato que ya existe, `SetLog.completedAt`, simplemente no se devuelve todavía) |
| **"Adherencia este Mes" (88%) + "Estás por encima del 92% de tu grupo de peso"** | ❌ No | Dos problemas distintos: (1) "Adherencia" es el mismo concepto ya documentado como gap sin resolver en tres lugares (`evolucion-error-adherencia`, Perfil de Miembro de Escuadrón, Hub de Escuadrón) — no hay ninguna fórmula de adherencia implementada en ningún lugar del backend; (2) "92% de tu grupo de peso" es una comparación contra una cohorte de otros usuarios — no existe ninguna agregación cross-user de ese tipo, y construirla ahora sería inventar tanto el concepto de "grupo de peso" como el cálculo de percentil |
| **"Insignias Recientes" (Racha Fuego, Nutri Elite, Iron Mind)** | ❌ No | **Son decorativas.** Ninguna tiene un criterio de desbloqueo visible en el diseño (ni aquí ni en ninguna otra pantalla ya auditada del archivo) — son 3 nombres de fantasía sin regla asociada. Se investigó si alguna mapea a un dato real: "Racha Fuego" podría sugerir el campo `SquadMembership.streakDays`, pero ese campo existe en el esquema sin ninguna lógica que lo calcule o actualice en ningún servicio (confirmado: `SquadService` solo lee el valor, nunca lo escribe) — es un campo inerte, no una racha real. "Nutri Elite" implica una evaluación de calidad nutricional por IA, que no existe. "Iron Mind" no tiene ningún significado técnico identificable. Inventar un criterio para cualquiera de las tres violaría directamente "no inventar logros, no inventar criterios" |
| **"Compartir con Escuadrón"** | N/A (acción, no dato) | Reutilizable de forma 100% real: navega al composer de Feed ya construido en Escuadrón Etapa 3 (`POST /squad/posts`), sin necesidad de una tarjeta especial de "logro" que no existe en el modelo `SquadPost` |

**Conclusión:** la especificación es **parcialmente realizable**. Se implementa la parte verificable (PRs + compartir), se omiten por completo las partes no verificables (Adherencia, comparación de grupo, insignias) — no se muestran ni siquiera como "PRÓXIMAMENTE", porque ese tratamiento (ya usado en otras pantallas para funciones reales pendientes de integración, como Google Fit o Garmin) implica que existe un producto/función concreta que falta conectar; aquí no hay ni siquiera un criterio definido que conectar. Mostrar un badge vacío "PRÓXIMAMENTE: Racha Fuego" sería inventar la existencia futura de un sistema de insignias que nadie ha diseñado todavía.

---

## 1. Pantallas involucradas

Una sola pantalla: **Progreso y Logros** (`142:6022`), accesible desde Perfil → Ajustes (mismo patrón de entrada que Integraciones y Salud / Seguridad y Avisos, badge "Ajustes" visible en el header del diseño). Sin pantallas adicionales — el diseño no muestra ningún destino de detalle para un PR individual ni para una insignia.

## 2. Reglas de desbloqueo

- **PRs:** no hay "desbloqueo" — es un cálculo continuo, no un logro binario. Cada ejercicio muestra el 1RM estimado más alto registrado hasta hoy, recalculado en cada consulta a partir de `SetLog` (igual que ya hace Escuadrón). "Hace 3 días" / "Hace 1 semana": se deriva de `SetLog.completedAt` del set que produjo ese récord (con fallback a `WorkoutSession.startedAt` si `completedAt` es nulo, mismo patrón ya usado en `getExerciseHistory`).
- **Insignias:** sin reglas — no se implementan en este bloque, ver veredicto arriba.
- **Adherencia:** sin reglas — no se implementa, gap ya documentado en 3 lugares distintos del proyecto.

## 3. Datos requeridos

Ninguno nuevo. Todo proviene de `SetLog` / `WorkoutSessionExercise` / `WorkoutSession`, ya existentes y ya consultados por `EvolutionService.getCompletedSets`. No se necesita ningún modelo Prisma nuevo ni migración — corrige la estimación original de `docs/NEXT_PARITY_OPPORTUNITIES.md`, que especulaba con un modelo `Achievement` nuevo sin haber visto el diseño real todavía.

## 4. Cambios de backend necesarios

- Extender `EvolutionService.getStrengthOverview(userId)`: agregar `achievedAt` (la fecha del set que produjo el 1RM actual) a cada elemento de `exercises`. Cambio aditivo — no rompe a `SquadService.getMemberProfile`, que ya consume `strengthOverview.exercises` y simplemente ignorará el campo nuevo.
- Ningún endpoint nuevo — el propio `GET /evolution/strength` (ya existente) sirve para esta pantalla tal cual, una vez extendido.
- Tests: extender `evolution.service.spec.ts` para cubrir `achievedAt` (con y sin `completedAt`, usando el fallback a `session.startedAt`).

## 5. Cambios de mobile necesarios

- Nueva pantalla `perfil/progreso-logros.tsx`: header (título + subtítulo ajustado — ver honestidad de copy abajo), sección "Récords Personales (PRs)" (lista real vía `GET /evolution/strength`, con fecha relativa calculada de `achievedAt`), botón "Compartir con Escuadrón" (navega a `/escuadron/feed/crear`).
- Nueva función en `evolutionApi.ts` (mobile) si el tipo de retorno de `getStrengthOverview` no incluye `achievedAt` todavía — extender el tipo existente.
- Entrada nueva en `perfil/index.tsx`, sección "Ajustes": fila "Progreso y Logros".
- **Ajuste de honestidad en el copy:** el subtítulo original ("Tu historial de marcas, evolución física e insignias acumuladas") menciona insignias que no se implementan — se ajusta a algo como "Tu historial de récords personales" para no prometer una sección que la pantalla no tiene.

## 6. Impacto estimado en la paridad Figma

Con solo la sección de PRs + acción de compartir reales (2 de 4 bloques de contenido del diseño original), la fidelidad honesta de esta pantalla es más baja que la estimación previa de `docs/FINAL_PARITY_PRIORITY.md` (~78%, hecha sin haber visto el diseño):

```
Fidelidad estimada: ~45% (PRs + compartir reales; Adherencia, comparación de
grupo e Insignias omitidas por completo, no mostradas ni como gap visual)
Ganancia: 1 pantalla × 0.45 × (1/105) ≈ +0.43 puntos de paridad
```

Menor que la estimación anterior (~0.75 pts), pero sigue siendo la opción de menor riesgo y complejidad de las cuatro evaluadas en `docs/FINAL_PARITY_PRIORITY.md` — cero dependencias de infraestructura, cero modelos nuevos, cero criterios inventados. La diferencia entre ~0.75 y ~0.43 es exactamente el costo de haber verificado el diseño real antes de implementar en vez de asumir.

## 7. Gaps documentados (no implementados, no inventados)

1. **Motor de adherencia** — sigue sin resolver, ahora confirmado como bloqueador en un cuarto lugar del proyecto (Evolución, Escuadrón Hub, Escuadrón Perfil de Miembro, y ahora Progreso y Logros).
2. **Comparación contra cohortes de usuarios ("grupo de peso")** — concepto nuevo, no visto en ninguna otra pantalla auditada hasta ahora. Requeriría decidir qué es un "grupo de peso", cómo se calcula el percentil, y con qué frecuencia se actualiza.
3. **Sistema de insignias/logros** — no existe ningún criterio de desbloqueo definido en Figma para ninguna insignia mostrada en todo el archivo (aquí ni en ninguna otra pantalla catalogada). Antes de construir cualquier insignia real, hace falta una decisión de producto explícita: qué insignias existen, qué las desbloquea, y si se calculan en vivo o se otorgan y persisten (afecta si `SquadMembership.streakDays` — hoy inerte — necesita by fin una fórmula real).
