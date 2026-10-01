# Próximas Oportunidades de Paridad Figma

**Fecha:** 2026-09-25
**Fuente:** `docs/FIGMA_TO_APP_MASTER_PLAN.md` §1.5, §1.6, §1.7, §1.8 (inventario ya auditado, sin investigación nueva de Figma en este documento). Denominador vigente de paridad: **105 pantallas totales**, 67 construidas (~51.3%) tras Etapa 4 de Escuadrón.

**Objetivo:** comparar los 4 bloques de pantallas pendientes de mayor impacto visual (Evolución, Perfil/Ajustes, Sueño, Nutrición) por **ganancia real de paridad vs. esfuerzo/riesgo de inventar funcionalidad**, y recomendar el orden. Documento puramente analítico — sin código, sin commits.

---

## Metodología de estimación

- Cada pantalla vale como máximo **1/105 ≈ 0.95 puntos** de paridad si se implementa con 100% de fidelidad — en la práctica ninguna pantalla de este proyecto ha alcanzado 100% (el promedio ponderado actual del trabajo ya hecho es ~80%), así que cada estimación de "ganancia" usa una fidelidad realista, no el máximo teórico.
- **"Complejidad" no es horas de UI — es si la pantalla necesita una capacidad de backend/infraestructura que hoy no existe.** Las 24 pantallas ya implementadas en este proyecto (Nutrición, Sueño, Escuadrón) muestran un patrón consistente: cuando la pantalla es "de datos reales" (formularios, listas, ajustes), la fidelidad lograda ronda 80-90%; cuando depende de una capacidad inexistente (IA, wearables, offline, pagos), o se omite por completo o se aterriza en 60-70% con partes deshabilitadas — y el esfuerzo para llegar ahí es 3-5× mayor porque primero hay que diseñar el backend que Figma da por hecho.
- Una pantalla "gap de producto" en el master plan significa: implementarla tal cual violaría la regla de "no inventar funcionalidad" — requiere decidir y construir una capacidad nueva antes de poder tocar la UI.

---

## Bloque 1 — Evolución (5 pantallas pendientes)

| Nodo Figma | Pantalla | Depende de (capacidad inexistente) |
|---|---|---|
| 147:6161 | S2-SyncError | Sincronización con Google Fit / Apple Health — la app nunca ha tenido esta capacidad, todo el registro es manual |
| 150:2859 | evolucion-error-adherencia | Motor de adherencia/rachas (%) + calendario semanal cruzando Sueño/Nutrición + "completar" sesiones retroactivas + conexión wearable — **4 capacidades distintas, ninguna existe** |
| 150:2959 | evolucion-error-historial | Modo offline completo (filtros sin conexión, caché local, sincronización diferida) — descartado del MVP en decisiones previas |
| 150:3038 | evolucion-error-insights | Motor de insights de IA con score de confianza, comparando volumen de entrenamiento contra sueño/frecuencia cardíaca — no existe ningún dato de frecuencia cardíaca ni motor de insights |
| 150:3110 | evolucion-error-metas-informe | Validación de metas + resolución de conflictos multi-dispositivo + exportación a PDF — 3 capacidades inexistentes combinadas |

**Ganancia estimada:** prácticamente nula a corto plazo. Ninguna de las 5 pantallas se puede construir sin decidir e implementar primero una capacidad de fondo (motor de adherencia, offline, IA de insights, sync de dispositivos, generación de PDF). Si se forzara una versión "simplificada" de cada una, el patrón ya usado en este proyecto (ver Sueño, Nutrición) sería mostrarlas deshabilitadas con "PRÓXIMAMENTE" — eso no suma paridad real, solo fidelidad visual de un estado que sigue sin funcionar.

**Complejidad:** 🔴 Alta en las 5 — cada una es, individualmente, del tamaño de un mini-proyecto (motor de adherencia, integración offline, motor de IA, sync multi-dispositivo, generación de documentos).

**Dependencia cruzada importante:** el motor de adherencia/rachas que bloquea `evolucion-error-adherencia` es **el mismo concepto** que ya se documentó como gap en el Perfil de Miembro de Escuadrón ("Adherencia Promedio", excluida del MVP) y en el Hub de Escuadrón ("Meta Semanal Colectiva", omitida). Si en algún momento se decide construir ese motor, desbloquea valor en 3 módulos a la vez — pero es una decisión de producto grande (qué cuenta como "adherencia", qué pasa si el usuario no tiene wearable), no una tarea de pantalla suelta.

**Recomendación:** no priorizar este bloque ahora. Es candidato a un bloque futuro específico ("Motor de Adherencia") si el usuario decide construir esa capacidad de fondo — en ese momento desbloquearía 1 pantalla de Evolución + mejoras en Escuadrón, justificando mejor el esfuerzo.

---

## Bloque 2 — Perfil / Ajustes (4 pantallas pendientes)

| Nodo Figma | Pantalla | Depende de (capacidad inexistente) |
|---|---|---|
| 142:6300 | Integraciones y Salud | **Ninguna** — es el punto de entrada de Perfil hacia Apps y Relojes de Sueño, que **ya está construido** (`sueno/apps-y-relojes.tsx`) |
| 142:6406 | Membresía y Pagos | Sistema de pagos/suscripciones (Stripe u otro) — no existe, ya documentado como gap grande en §4/§5 del plan maestro |
| 142:6513 | Seguridad y Avisos | **Ninguna documentada** — "pantalla de ajustes genérica" según el propio inventario |
| 142:6608 | Ayuda y Soporte | **Ninguna documentada** — "pantalla de ajustes genérica" según el propio inventario |

**Ganancia estimada:** **3 de las 4 pantallas (Integraciones y Salud, Seguridad y Avisos, Ayuda y Soporte) no dependen de ninguna capacidad nueva.** Son pantallas de navegación/ajustes que pueden construirse con datos y enlaces 100% reales:
- Integraciones y Salud: una fila de menú que enlaza a `sueno/apps-y-relojes.tsx` (ya existe) — prácticamente gratis.
- Seguridad y Avisos: probablemente cambio de contraseña (ya hay `AuthService` con hash real), enlaces a política de privacidad/términos — sin inventar nada si se aterriza al alcance real de lo que el backend ya soporta.
- Ayuda y Soporte: contenido mayormente estático (FAQ, contacto) — bajo riesgo de "inventar funcionalidad" porque el propio nombre no promete nada dinámico.

Con fidelidad realista ~80-88% cada una (son pantallas simples, poco que omitir): **3 × ~0.84 pts ≈ +2.4 puntos de paridad**, sin tocar el backend más allá de, como mucho, un endpoint de cambio de contraseña si no existe ya.

La 4ª (Membresía y Pagos) depende de una decisión de producto grande (qué pasarela, qué modelo de suscripción, cómo se liga al "doble XP" de Escuadrón ya mencionado en Figma) — **se recomienda excluirla de este bloque** y tratarla como su propio proyecto cuando haya decisión de negocio.

**Complejidad:** 🟢 Baja en 3 de 4 (sin dependencias de backend nuevas, mismo patrón ya usado en `perfil/objetivos.tsx`). 🔴 Alta en Membresía y Pagos (excluida de la recomendación).

**Bonus fuera de las "4" pero adyacente:** `S4-ProgressAchievements` (142:6022) — logros/progreso — no está en el conteo de 4 que dio el usuario, pero es del mismo módulo. Depende de un modelo `Achievement` nuevo: complejidad 🟡 media (nuevo modelo Prisma + decidir qué logros son reales y calculables — p. ej. "10 entrenamientos completados", "primera receta guardada" — vs. inventar insignias sin dato detrás). No se incluye en el cálculo de ganancia de este bloque por ser un pendiente aparte, pero se menciona porque es la extensión natural si el bloque 2 se aprueba y se quiere ir un paso más allá.

**Recomendación:** ✅ **Mejor punto de partida.** Máxima ganancia de paridad por esfuerzo de todos los bloques evaluados — cero pantallas bloqueadas por capacidades inexistentes (excluyendo Pagos).

---

## Bloque 3 — Sueño / Descanso (4 pantallas fuera del MVP)

| Nodo Figma | Pantalla | Depende de (capacidad inexistente) |
|---|---|---|
| 160:2968 | Preparar Descanso | Alarma inteligente + "entorno" (sonido, "GYMIA Ring" — concepto nunca definido en ningún documento) — el checklist de preparación en sí podría construirse con `expo-notifications` (ya instalado, mismo patrón que `nutricion/horarios.tsx`), pero la mitad del diseño depende de un dispositivo que no existe |
| 160:3055 | Seguimiento Activo | Captura continua en segundo plano (fase de sueño, FC, movimiento, ruido) — mismo límite de infraestructura ya documentado para Apple Health (Expo Go sin dev client nativo, ver §1.7) |
| 171:3104 | Conectar Oura | Integración OAuth con la API de Oura — dependencia **externa** (cuenta de desarrollador Oura, credenciales, aprobación de la plataforma), fuera del control del equipo |
| 171:3198 | Fuentes y Diagnóstico | Ninguna capacidad bloqueante, pero el propio inventario ya señala que "no aplica con una sola fuente, no hay conflictos que resolver" — se podría construir vacía, pero sin valor real hasta que exista una segunda fuente conectada |

**Ganancia estimada:** baja. Solo "Preparar Descanso" tiene una vía parcialmente viable (el checklist + notificación, ~40% del diseño), pero incluso esa mitad requeriría omitir "GYMIA Ring" y la alarma inteligente real (dato de sueño en vivo que tampoco existe) — quedaría una pantalla de fidelidad baja (~50-55%) por menos de 1 punto de paridad. Las otras 3 están bloqueadas por el mismo límite de infraestructura ya confirmado en Etapa Sueño MVP (Expo Go) o por una dependencia externa (Oura) que no se puede resolver desde el código.

**Complejidad:** 🔴 Alta en 3 de 4. 🟡 Media en "Preparar Descanso" (parcialmente viable, pero de bajo valor).

**Recomendación:** no priorizar. El propio bloque de Sueño ya documentó este límite al cerrar el MVP — nada cambió desde entonces que lo desbloquee.

---

## Bloque 4 — Nutrición (6 pantallas restantes)

| Nodo Figma | Pantalla | Depende de (capacidad inexistente) |
|---|---|---|
| 111:8831 | s03-active-camera | Reconocimiento de comida por foto (IA de visión) |
| 115:4577 | Screen_3_Camera_Denied | Mismo gap — estado de permiso denegado de una función que no existe |
| 115:4646 | Screen_4_Barcode_Error | Escaneo de código de barras + base de datos externa de alimentos |
| 115:4718 | Screen_5_Search_Empty_Offline | Soporte offline completo |
| 115:4789 | Screen_6_AI_Vision_Low_Confidence | Reconocimiento por foto (mismo gap que s03) |
| 115:4931 | Screen_8_Sync_Conflicts_Complete | Sincronización offline |

**Ganancia estimada:** nula a corto plazo. Las 6 pantallas se agrupan en solo 3 capacidades de fondo (IA de visión para comida, escaneo de código de barras + DB externa, soporte offline) — pero las 3 son gaps ya descartados explícitamente del MVP en decisiones de producto previas a este documento, no simples pendientes técnicos. Ninguna es construible sin decidir primero incorporar esa capacidad.

**Complejidad:** 🔴 Alta en las 6 — mismo patrón que Evolución: cada "pantalla" es en realidad la punta de un sistema completo (visión por computadora, integración con proveedor de códigos de barras, arquitectura offline-first).

**Recomendación:** no priorizar. Nutrición ya alcanzó todo lo que es honestamente construible sin esas 3 capacidades (10/16 ya implementadas, con adaptaciones documentadas) — este resto es, en la práctica, el mismo tipo de bloqueo que Evolución y Sueño.

---

## Comparación directa

| Bloque | Pantallas | Bloqueadas por capacidad inexistente | Construibles ahora | Ganancia estimada | Complejidad |
|---|---|---|---|---|---|
| **2 — Perfil/Ajustes** | 4 | 1 (Pagos) | **3** | **+2.4 pts** | 🟢 Baja (3/4) |
| 1 — Evolución | 5 | 5 | 0 | ~0 pts | 🔴 Alta (5/5) |
| 3 — Sueño | 4 | 3 | 0-1 (parcial, bajo valor) | <1 pt | 🔴 Alta (3/4) |
| 4 — Nutrición | 6 | 6 | 0 | ~0 pts | 🔴 Alta (6/6) |

## Orden recomendado

1. **Bloque 2 — Perfil/Ajustes (Integraciones y Salud, Seguridad y Avisos, Ayuda y Soporte).** Único bloque con ganancia de paridad inmediata y sin inventar nada — mismo patrón ya usado en `perfil/objetivos.tsx`. Excluir Membresía y Pagos de este mismo bloque (tratarla aparte, ligada a una decisión de negocio sobre pagos).
2. **Ninguno de los otros 3 bloques está listo para priorizarse tal cual.** Los tres comparten el mismo obstáculo: cada pantalla pendiente requiere primero una decisión de producto y una capacidad de backend nueva (motor de adherencia/IA, offline, wearables/OAuth externo, reconocimiento de imagen, pagos) — no son "pantallas pendientes", son proyectos de infraestructura disfrazados de pantallas. Si se quiere avanzar en alguno de ellos, la primera pregunta no es "qué pantalla construyo" sino "qué capacidad de fondo decido construir primero" — y esa es una decisión de producto, no de implementación, igual que ya ocurrió con Sueño y Escuadrón antes de escribir su primera línea de código.
3. Si se busca una segunda opción de bajo riesgo después del Bloque 2: **`S4-ProgressAchievements`** (logros) es el siguiente candidato más barato de los pendientes de infraestructura — un solo modelo nuevo (`Achievement`), acotable a 3-4 logros reales y calculables, sin IA ni wearables de por medio.

**Mi recomendación:** empezar por el Bloque 2 (las 3 pantallas sin dependencias). Es el único de los cuatro donde "más pantallas implementadas" se traduce directamente en paridad real sin comprometer la regla de "no inventar funcionalidad" ni abrir un proyecto de infraestructura nuevo.
