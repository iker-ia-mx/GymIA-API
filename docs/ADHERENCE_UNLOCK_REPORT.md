# Reporte de Desbloqueo — Motor de Adherencia

**Fecha:** 2026-09-25
**Fuente:** `docs/ADHERENCE_ENGINE_ARCHITECTURE.md` §10 (impacto ya anticipado en el diseño), `docs/EVOLUTION_REMAINING_SPEC.md`, `docs/ESCUADRON_PRODUCT_SPEC.md` §13, `docs/ACHIEVEMENTS_PRODUCT_SPEC.md`, estado actual de `SquadService`/`SquadMembership`/`EvolutionController` tras el MVP implementado. Documento puramente analítico — sin código, sin commits.

**Premisa del usuario, confirmada en este análisis:** el valor de haber construido `AdherenceService` no es el +0.2 de paridad ya capturado — es que ahora existe una única fuente de verdad, reutilizable, sin deuda estructural, que puede sustituir datos falsos/inertes en 4 lugares del proyecto sin escribir un nuevo motor cada vez.

---

## 1. Evolución — qué queda desbloqueado

**No se desbloquea la pantalla `evolucion-error-adherencia` como tal.** De sus 6 elementos (ver `docs/EVOLUTION_REMAINING_SPEC.md`), el motor solo resuelve los que dependen puramente del cálculo de adherencia/racha — el resto sigue bloqueado por gaps no relacionados:

| Elemento de `evolucion-error-adherencia` | Estado tras el motor |
|---|---|
| Badge "Adherencia Parcial" / número de adherencia | ✅ Desbloqueado — `AdherenceService.getAdherence` ya lo calcula |
| "Racha de N días" (el número) | ✅ Desbloqueado — `getCurrentStreak` |
| "-15%" (variación respecto al periodo anterior) | ✅ **Desbloqueo adicional no anticipado en la arquitectura original:** se puede derivar llamando `getAdherence` dos veces con ventanas distintas (mes actual vs. mes anterior) y restando — no requiere ningún dato nuevo, solo dos llamadas a la misma función ya construida |
| Calendario Semanal (columna de Entrenamiento) | ✅ Desbloqueado parcialmente — requiere una extensión menor y de bajo riesgo: que `getAdherence` devuelva también la lista de fechas planeadas/cumplidas, no solo los conteos agregados (hoy solo expone números) |
| "Racha de 12 días perdida" (notificación del evento) | ❌ Sigue sin resolver — detectar que una racha "se acaba de romper" requiere comparar contra un valor anterior guardado o lógica de eventos, ya documentado como Fase posterior en `docs/ADHERENCE_ENGINE_ARCHITECTURE.md` §12 |
| "Completar Ayer" (registro retroactivo) | ❌ Sigue sin resolver — gap de una función de registro, no de cálculo de adherencia |
| "Recalcular Plan" | ❌ Sigue sin resolver — requiere un motor de ajuste de rutina |
| Calendario Semanal (columnas de Sueño/Nutrición) | ❌ Sigue sin resolver — ninguno de esos dos módulos tiene un concepto de "día esperado" tan claro como `trainingDays` |
| "Apple Health/Google Fit Desconectado" | ❌ Sigue sin resolver — sync de wearables para entrenamiento, no relacionado con el motor de adherencia |

**Conclusión:** se puede construir una **tarjeta simple y honesta de adherencia** en el dashboard de Evolución (`dashboard-evolucion`, ya implementado) con porcentaje, racha y variación mensual — pero no la pantalla completa de error/recuperación que diseñó Figma, que sigue dependiendo de capacidades no relacionadas con este motor.

## 2. Escuadrón — qué puede pasar de placeholder a datos reales

`SquadMembership.streakDays` existe en el esquema desde la Etapa 1 de Escuadrón pero **nunca se ha escrito** — todo miembro muestra siempre "0 DÍAS 🔥", en el Hub (`index.tsx`) y en cada fila de `miembros.tsx`. No es un placeholder deshabilitado, es un **dato activo pero permanentemente falso** (muestra 0 con apariencia de dato real).

| Pantalla | Dato hoy | Con el motor |
|---|---|---|
| Hub — tarjeta de identidad ("X DÍAS 🔥") | Siempre 0, leído de la columna inerte | ✅ Real, vía `AdherenceService.getCurrentStreak(userId)` en vez de la columna |
| Miembros — fila de cada miembro ("Racha: Xd") | Siempre 0 para todos | ✅ Real, mismo cambio — `SquadService.listMembers` dejaría de leer `streakDays` y calcularía en vivo |
| Ranking del Hub (ordenado por XP) | No usa racha para ordenar, solo la muestra | Sin cambio de comportamiento, solo el número mostrado deja de ser falso |
| "Meta Semanal Colectiva" (kcal grupales) | No implementada | ❌ El motor no la resuelve — es una métrica de grupo distinta (agregación de calorías, no adherencia individual), fuera de alcance de este motor |

**Es la corrección de más bajo riesgo de las cuatro** — no reabre ninguna decisión de producto (mostrar la racha del miembro **ya estaba aprobado** desde el MVP original de Escuadrón; el problema es que nunca tuvo un dato real detrás). Es, en la práctica, corregir un bug de datos, no ampliar alcance.

## 3. Perfil de Miembro — qué mejora

Dos cosas distintas:

1. **Racha del miembro consultado** — mismo arreglo que en Hub/Miembros (dato ya aprobado, hoy inerte).
2. **"Adherencia Promedio"** — el diseño de Figma la incluye, pero `docs/ESCUADRON_PRODUCT_SPEC.md` §13 la **excluyó explícitamente** del MVP aprobado de Escuadrón ("sin 'Adherencia Promedio' ni 'Sugerencias IA aceptadas', ambos dependen de gaps sin resolver"). Ese gap ya no existe — el motor lo resuelve técnicamente — pero **es una decisión de alcance de producto que hay que reabrir explícitamente**, no algo que se activa solo porque la infraestructura ya está lista. La integración en sí (llamar a `AdherenceService.getAdherence(targetUserId)` después de que `assertSharedSquad` autorice) es trivial y sigue exactamente el mismo patrón ya usado para los PRs (`EvolutionService.getStrengthOverview`).

Lo que **sigue sin desbloquearse** en Perfil de Miembro, incluso con Adherencia Promedio agregada: "Entrenamientos (24/30 días)" (conteo distinto, no es lo mismo que adherencia — sería un dato nuevo, no cubierto por este motor), "Sugerencias IA aceptadas" (motor de IA inexistente), "Rango" (sistema de rangos inexistente), botones "Comparar mis estadísticas"/"Enviar reconocimiento" (fuera del MVP).

## 4. Achievements — qué logros pueden pasar a verificables

De las 3 insignias decorativas identificadas en `docs/ACHIEVEMENTS_PRODUCT_SPEC.md` ("Racha Fuego", "Nutri Elite", "Iron Mind"), **una** ahora tiene un dato real y verificable detrás:

| Insignia | ¿Verificable ahora? |
|---|---|
| **Racha Fuego** | ✅ **Sí, potencialmente** — `getCurrentStreak` ya calcula exactamente lo que el nombre sugiere. Falta una única decisión de producto pequeña y explícita: **qué umbral de días consecutivos la activa** (ej. ≥7 días) — no se propone un número aquí para no inventar el criterio; es una decisión que corresponde al usuario, no a este análisis |
| Nutri Elite | ❌ No — depende de una evaluación de calidad nutricional (IA), sin relación con el motor de adherencia de entrenamiento |
| Iron Mind | ❌ No — sin significado técnico identificable en ningún lugar de Figma; sigue siendo puramente decorativa |

**"Adherencia este Mes" y su comparación contra el mes anterior** (mismo desbloqueo que en Evolución, punto 1) también podrían enriquecer la tarjeta ya construida en `perfil/progreso-logros.tsx` con una variación ("+5% respecto al mes pasado"), sin trabajo nuevo más allá de la segunda llamada a `getAdherence`.

## 5. Incremento potencial de paridad si se aprovecha completamente

Estimación honesta, no exacta — igual que en Achievements, el número real se conocerá al construirlo, no antes:

| Cambio | Pantalla afectada | Fidelidad estimada | Ganancia |
|---|---|---|---|
| Racha real en Hub + Miembros (Escuadrón) | 2 pantallas ya contadas (~82%, ~78%) | +2-3 pts de fidelidad cada una | ~+0.05 pts totales |
| Adherencia Promedio + racha real en Perfil de Miembro | 1 pantalla ya contada (~65%) | 65% → ~76% | ~+0.10 pts |
| Insignia "Racha Fuego" verificable en Achievements | 1 pantalla ya contada (~62%) | 62% → ~68% | ~+0.06 pts |
| Tarjeta de adherencia en dashboard de Evolución | 1 pantalla ya contada, fidelidad no cuantificada individualmente (bucket "24 @ 72%" heredado del Sprint Figma Parte 1) | Incremento menor, no cuantificable con precisión sin auditar esa pantalla aparte | ~+0.02-0.05 pts (estimado) |

**Total estimado: +0.2 a +0.3 puntos de paridad adicionales.** Ninguno de estos cuatro añade una pantalla nueva al denominador — todos mejoran la fidelidad de pantallas que ya cuentan como implementadas. Esto confirma exactamente el punto del usuario: **el valor de este motor no está en los puntos de paridad que todavía puede sumar (modestos), sino en haber eliminado 3-4 datos falsos/inertes con una sola pieza de infraestructura ya pagada.**

## 6. Orden recomendado para capturar el valor

1. **Escuadrón Hub + Miembros (racha real).** Menor esfuerzo, cero riesgo, cero decisión de producto pendiente — es una corrección de un dato que ya estaba aprobado para mostrarse y simplemente nunca funcionó. Se recomienda primero porque no requiere ninguna aprobación adicional más allá de "sí, arregla esto".
2. **Perfil de Miembro — Adherencia Promedio + racha real.** Mismo patrón técnico que el punto 1 (trivial), pero requiere una decisión explícita: reabrir el alcance que `ESCUADRON_PRODUCT_SPEC.md` §13 excluyó. Se recomienda pedir esa aprobación puntual antes de tocar código, no asumirla.
3. **Achievements — insignia "Racha Fuego" verificable.** Requiere decidir el umbral exacto (única pieza de producto pendiente) y construir la UI de insignia (más trabajo que los dos puntos anteriores, que son solo "cambiar la fuente de un número").
4. **Evolución — tarjeta de adherencia en el dashboard.** Menor prioridad: no corrige ningún dato falso (a diferencia de Escuadrón), es una mejora incremental sobre una pantalla que ya funciona bien; el "-15%" de variación mensual es la única pieza nueva de valor real ahí.

No se implementó código ni se hicieron commits — a la espera de que se decida qué parte de este reporte se autoriza a construir.
