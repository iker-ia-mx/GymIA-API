# Evolución Restante — Especificación de las 5 Pantallas Pendientes

**Fecha:** 2026-09-25
**Fuente:** diseño real traído de Figma en este turno para las 5 pantallas (fileKey `O4cXfRJ7qCbKuH3Jdon00k`) — sin investigación previa de estas 5 en detalle, solo el inventario de nombres ya hecho en `FIGMA_TO_APP_MASTER_PLAN.md` §1.5.

---

## Veredicto explícito (antes de la tabla por pantalla)

**Ninguna de las 5 pantallas tiene contenido honestamente implementable hoy.** No es una cuestión de "parcialmente sí, parcialmente no" como en Achievements — en este bloque, **cada uno de los 5 diseños completos** da por sentada una capacidad de infraestructura que:

1. No existe en el backend ni en el proyecto, y
2. Está explícitamente prohibido inventar en las reglas de este bloque ("no inventar métricas", "no inventar IA", "no inventar motor de adherencia", "no crear datos simulados").

Esto corrige la estimación de `docs/FINAL_PARITY_PRIORITY.md` / `docs/ROADMAP_RECALCULATION.md` (~2.6 pts vía "shell honesto", basada en el patrón de S1-EmptyEvolution/S4-ProgressPhotosError). Esa estimación asumía que estas 5 pantallas eran del mismo tipo que las ya implementadas en Fase 1 (estados vacíos o de validación sobre datos reales). **No lo son.** S1-EmptyEvolution y S4-ProgressPhotosError son estados de "todavía no tienes datos" sobre un sistema que sí existe (registro manual de entrenamientos y fotos). Las 5 pantallas de este documento son estados de error de sistemas que **nunca se han construido y no están en el alcance aprobado** (sincronización con wearables, motor de adherencia, modo offline, motor de insights de IA, validación de metas + exportación de PDF).

---

## 1. S2-SyncError (`147:6161`) — "Sincronización Fallida"

| Elemento del diseño | Estado |
|---|---|
| "Sincronización Fallida" / "No se pudo recuperar tu última sesión de fuerza" | ❌ Depende de infraestructura inexistente — la app nunca sincroniza sesiones de fuerza con nada; todo el registro es manual. No hay ningún intento de sincronización que pueda "fallar" |
| Botón "Reintentar Sincronizar" | ❌ No hay nada que reintentar |
| Botón "Importar Manualmente" | ⚠️ El concepto ya existe en la app (registrar una sesión manualmente), pero como **destino real** ya es la pantalla de Entrenar — no hace falta esta pantalla de error para llegar ahí |
| "Volver a la pestaña de Entrenamiento" | ✅ Navegación trivial, ya existe |
| "Vincular cuenta con Google Fit / Apple Health" | ❌ No existe integración de salud para datos de fuerza (la única integración real, `SleepDataSource`, es específica de Sueño y no aplica a entrenamientos) |

**Elementos representables honestamente sin inventar:** ninguno con valor propio — la única pieza real (navegar a Entrenar) no necesita una pantalla de error dedicada para existir.
**Impacto en paridad:** 0.

---

## 2. evolucion-error-adherencia (`150:2859`) — "Adherencia y Hábitos"

| Elemento del diseño | Estado |
|---|---|
| Badge "Adherencia Parcial" | ❌ Motor de adherencia — explícitamente prohibido inventar este turno |
| "Racha de 12 días perdida" / "-15% de adherencia" | ❌ Racha y porcentaje de adherencia — no existe ningún cálculo de esto en el backend (mismo gap confirmado en Escuadrón y Achievements) |
| Botón "Completar Ayer" (completar sesión retroactiva) | ❌ No existe la función de registrar una sesión pasada como completada retroactivamente |
| Botón "Recalcular Plan" | ❌ No existe motor de recálculo de plan de entrenamiento |
| Calendario semanal con "Datos Faltantes (Sueño/Nutrición)" | ❌ Agregación cruzada Entrenar+Sueño+Nutrición por día — no existe |
| "Apple Health / Google Fit Desconectado" + botón "Conectar Salud ahora" | ❌ Mismo gap que S2-SyncError — sin integración de salud para datos de entrenamiento |

**Elementos representables honestamente sin inventar:** ninguno.
**Impacto en paridad:** 0.

---

## 3. evolucion-error-historial (`150:2959`) — "Historial y Comparación" (Modo Offline)

| Elemento del diseño | Estado |
|---|---|
| Badge "MODO OFFLINE" | ❌ La app no tiene modo offline — todas las pantallas requieren conexión en vivo a la API |
| Filtros "Fuerza Max" / "Últimos 180 días" con aviso de incompatibilidad offline | ❌ Depende del modo offline para tener sentido |
| "No hay datos locales para este periodo" / botón "Ver Datos Locales" | ❌ No existe ningún caché local de datos |
| Botón "Reintentar Conexión" | ❌ No hay una conexión específica que reintentar en este contexto (la app ya maneja errores de conectividad de forma genérica en `sistema/*`, pero ese flujo es distinto y ya está implementado) |
| "Borrador sincronizado hace 2 horas... se guardarán localmente" | ❌ No existe borrador local ni cola de sincronización diferida |

**Elementos representables honestamente sin inventar:** ninguno — el manejo de conectividad genérico que sí existe (`sistema/no-internet`, etc.) ya cubre el caso real de "sin conexión"; esta pantalla es un concepto distinto (modo offline con caché local) que no tiene ningún equivalente real en la app.
**Impacto en paridad:** 0.

---

## 4. evolucion-error-insights (`150:3038`) — "Insights de Inteligencia Artificial"

| Elemento del diseño | Estado |
|---|---|
| Badge "Confianza Baja (30%)" | ❌ Motor de IA con score de confianza — explícitamente prohibido inventar |
| "Recomendación Contradictoria Detectada" (volumen extremo vs. fatiga cardíaca) | ❌ No hay dato de frecuencia cardíaca en ningún lugar del backend, ni motor de recomendaciones |
| "¿Por qué la confianza es baja?" (faltan registros de Sueño / Grasa Corporal) | ⚠️ Los datos subyacentes que menciona (registros de Sueño, medidas de grasa corporal) sí existen como conceptos reales en la app — pero el marco que los envuelve ("confianza del algoritmo") no existe, así que mostrar esta lista sin ese marco sería sacarla de contexto, no honestidad |
| Botones "Completar Datos" / "Volver a Analizar" | ❌ "Volver a Analizar" no tiene ningún análisis real que rehacer |
| "Fuentes del Algoritmo" (modelo adaptativo, exclusión por inconsistencia cardíaca) | ❌ No existe ningún modelo adaptativo |

**Elementos representables honestamente sin inventar:** ninguno como pantalla — los 2 datos reales mencionados (Sueño, Grasa Corporal) ya se pueden completar desde sus propios flujos existentes (`sueno/`, `evolucion/cuerpo-agregar.tsx`), sin necesidad de una pantalla de "insights de IA" que los envuelva en un marco inexistente.
**Impacto en paridad:** 0.

---

## 5. evolucion-error-metas-informe (`150:3110`) — "Metas e Informes"

| Elemento del diseño | Estado |
|---|---|
| Badge "METAS IA" / "Borrador de Metas guardado localmente (Autoguardado)" | ❌ Autoguardado local — no existe (mismo gap de offline) |
| "Conflicto de Meta Imposible o Duplicada" + botón "Resolver y Modificar Meta" | ❌ No existe ningún motor de validación de metas que detecte inviabilidad o duplicados |
| "Conflicto entre Dispositivos" (iPhone vs. Apple Watch) | ❌ No hay ninguna sincronización multi-dispositivo |
| "Error al Exportar Informe" (PDF) | ❌ No existe ninguna capacidad de generación ni exportación de PDF en el proyecto |

**Elementos representables honestamente sin inventar:** ninguno.
**Impacto en paridad:** 0.

---

## Resumen

| Pantalla | Implementable hoy | Depende de infraestructura inexistente | Impacto en paridad |
|---|---|---|---|
| S2-SyncError | No | Sync de wearables para entrenamientos | 0 |
| evolucion-error-adherencia | No | Motor de adherencia (prohibido inventar) | 0 |
| evolucion-error-historial | No | Modo offline / caché local | 0 |
| evolucion-error-insights | No | Motor de IA de insights (prohibido inventar) | 0 |
| evolucion-error-metas-informe | No | Validación de metas + multi-dispositivo + exportación PDF | 0 |

**Total: 0 pantallas implementables, +0 puntos de paridad.** No se implementa ningún código en este bloque — no hay nada que construir sin violar al menos una de las reglas explícitas de este turno ("no inventar métricas/IA/motor de adherencia/datos simulados").

## Gaps documentados (consolidado, no repetido en cada tabla)

1. **Sincronización de datos de entrenamiento con wearables** (Apple Health/Google Fit para fuerza, no solo sueño) — bloquea S2-SyncError y parte de evolucion-error-adherencia y evolucion-error-metas-informe.
2. **Motor de adherencia/rachas** — bloquea evolucion-error-adherencia. Es el mismo gap ya confirmado en 4 lugares del proyecto (Evolución, Escuadrón Hub, Escuadrón Perfil de Miembro, Achievements) — ver `docs/ACHIEVEMENTS_PRODUCT_SPEC.md` §7.
3. **Modo offline / caché local** — bloquea evolucion-error-historial y parte de evolucion-error-metas-informe. Ya descartado del MVP en decisiones de producto previas a este documento.
4. **Motor de insights de IA con score de confianza** — bloquea evolucion-error-insights. Requeriría, como mínimo, datos de frecuencia cardíaca que no existen en ningún lugar del backend.
5. **Motor de validación de metas** (detección de objetivos inviables/duplicados) — bloquea evolucion-error-metas-informe.
6. **Sincronización multi-dispositivo** — bloquea evolucion-error-metas-informe.
7. **Generación/exportación de informes en PDF** — bloquea evolucion-error-metas-informe.

## Recomendación

No implementar nada de este bloque tal como está diseñado en Figma. Las únicas dos vías para desbloquear paridad real aquí son:
- Decidir construir alguna de las 7 capacidades listadas arriba como proyecto de infraestructura deliberado (la de mayor apalancamiento es el motor de adherencia, por aparecer en 4 lugares distintos del proyecto — ver `docs/ROADMAP_RECALCULATION.md`), o
- Reconsiderar el bloque siguiente del roadmap: con Evolución confirmado en 0 pantallas construibles, Sueño avanzado (Fuentes y Diagnóstico, ~0.75 pts, ya verificado como real y sin dependencias en `docs/FINAL_PARITY_PRIORITY.md`) vuelve a ser la única opción con ganancia de paridad verificada y sin abrir un proyecto de infraestructura mayor.
