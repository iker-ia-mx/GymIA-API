# Prioridad Final de Paridad Figma

**Fecha:** 2026-09-25
**Fuente:** `docs/FIGMA_TO_APP_MASTER_PLAN.md` §1.5, §1.7, §1.8 (S4-ProgressAchievements), §1.6, y el análisis previo en `docs/NEXT_PARITY_OPPORTUNITIES.md` (bloque Perfil ya ejecutado). Denominador vigente: **105 pantallas**, 70 construidas, **~53.4% de paridad actual**. Cada pantalla vale ~0.95 puntos a 100% de fidelidad.

**Objetivo:** comparación objetiva de los 4 bloques restantes de mayor impacto visual, con dos vías evaluadas donde aplica — **funcional completa** (construir la capacidad real que Figma asume) vs. **honesta simplificada** (mismo patrón ya usado en Sueño/Escuadrón/Perfil: fiel al layout, deshabilitada, sin fabricar datos ni funcionalidad) — porque para 3 de los 4 bloques la vía funcional completa está bloqueada por infraestructura que no existe, y la vía honesta simplificada sí es una opción real que no se evaluó a fondo en el documento anterior. Documento puramente analítico — sin código, sin commits.

---

## 1. Evolución pendiente (5 pantallas)

**Pantallas restantes:** S2-SyncError (147:6161), evolucion-error-adherencia (150:2859), evolucion-error-historial (150:2959), evolucion-error-insights (150:3038), evolucion-error-metas-informe (150:3110).

| Vía | Ganancia estimada | Complejidad | Dependencias técnicas | Dependencias de producto | Riesgo | Tiempo relativo |
|---|---|---|---|---|---|---|
| **Funcional completa** | ~0 pts (ninguna es construible tal cual) | 🔴 Alta — cada pantalla es la punta de un sistema completo (sync wearable, motor de adherencia/rachas, offline, motor de insights de IA, validación de metas + PDF) | Motor de adherencia (compartido con Escuadrón y Sueño), soporte offline, motor de IA con score de confianza, sync multi-dispositivo, generación de PDF — **5 capacidades distintas, ninguna existe** | Qué cuenta como "adherencia", qué pasa sin wearable, qué es "confianza baja" en un insight | 🔴 Alto — cualquier versión simplificada corre el riesgo de fabricar datos (%, scores) que no se calculan realmente | XL (semanas por capacidad, no por pantalla) |
| **Honesta simplificada** | ~2.6 pts (5 × ~55% fidelidad) | 🟢 Baja — mismo patrón ya usado en S1-EmptyEvolution/S4-ProgressPhotosError (shell fiel al layout, sin datos falsos, con copy honesto sobre qué falta y por qué) | Ninguna nueva | Ninguna — son estados informativos, no funcionalidad | 🟡 Medio — hay que resistir la tentación de mostrar un número/porcentaje decorativo; el riesgo se mitiga si el copy es honesto | M (5 pantallas de solo-UI, sin backend) |

**Nota:** la vía honesta simplificada de `evolucion-error-adherencia` es la más delicada de las 5 — el diseño depende de 4 conceptos a la vez (adherencia, calendario cruzado, "completar" sesiones retroactivas, wearables). Un shell fiel ahí corre más riesgo de parecer "casi funcional" sin serlo; las otras 4 son más claramente estados de error/no-disponible.

---

## 2. Sueño avanzado (4 pantallas)

**Pantallas restantes:** Preparar Descanso (160:2968), Seguimiento Activo (160:3055), Conectar Oura (171:3104), Fuentes y Diagnóstico (171:3198).

| Pantalla | Vía | Ganancia | Complejidad | Dependencias técnicas | Dependencias de producto | Riesgo | Tiempo |
|---|---|---|---|---|---|---|---|
| Fuentes y Diagnóstico | **Funcional, real** | ~0.75 pts (~78%) | 🟢 Baja | Ninguna — reutiliza `SleepDataSource` ya construido | Ninguna | 🟢 Bajo | S |
| Preparar Descanso | Honesta parcial | ~0.45 pts (~48%) | 🟡 Media | `expo-notifications` (ya instalado) para el checklist + recordatorio; "GYMIA Ring" y alarma inteligente real se omiten (concepto nunca definido, dato de sueño en vivo inexistente) | Ninguna nueva | 🟡 Medio — fácil que el checklist parezca "más inteligente" de lo que es | M |
| Seguimiento Activo | Bloqueada | ~0 pts | 🔴 Alta | Captura continua en segundo plano — mismo límite de HealthKit/Expo Go ya documentado (sin dev client nativo) | Ninguna | 🔴 Alto si se fuerza | XL |
| Conectar Oura | Bloqueada | ~0 pts | 🔴 Alta | OAuth con la API de Oura — **dependencia externa** (cuenta de desarrollador, credenciales, aprobación de plataforma) | Decisión de negocio: ¿vale la pena una integración de un solo proveedor de anillos? | 🔴 Alto — fuera del control del equipo | XL + espera externa |

**Total del bloque:** ~1.2 pts reales (Fuentes y Diagnóstico + Preparar Descanso parcial) si se toma solo lo viable; Seguimiento Activo y Conectar Oura quedan fuera bajo cualquier vía honesta.

**Hallazgo:** a diferencia de como se presentó en `docs/NEXT_PARITY_OPPORTUNITIES.md` ("baja ganancia, alta complejidad" para las 4 juntas), **Fuentes y Diagnóstico es en realidad una pantalla real y barata** — el análisis anterior la descartó por "no aplicar con una sola fuente", pero mostrar honestamente "1 fuente conectada, sin conflictos" es exactamente lo que hay que mostrar — no es una simplificación, es la verdad. Corrección respecto al documento anterior.

---

## 3. Nutrición restante (6 pantallas)

**Pantallas restantes:** s03-active-camera (111:8831), Screen_3_Camera_Denied (115:4577), Screen_4_Barcode_Error (115:4646), Screen_5_Search_Empty_Offline (115:4718), Screen_6_AI_Vision_Low_Confidence (115:4789), Screen_8_Sync_Conflicts_Complete (115:4931).

| Vía | Ganancia estimada | Complejidad | Dependencias técnicas | Dependencias de producto | Riesgo | Tiempo relativo |
|---|---|---|---|---|---|---|
| **Funcional completa** | ~0 pts | 🔴 Alta — 3 capacidades distintas (visión IA, escaneo + DB externa de códigos de barras, offline-first) | IA de reconocimiento de comida, proveedor de base de datos de códigos de barras, arquitectura offline completa | Las 3 ya están descartadas del MVP en decisiones de producto previas a este documento, no son "pendientes técnicos" | 🔴 Alto | XL (proyectos completos, no pantallas) |
| **Honesta simplificada** | ~1.7 pts (6 × ~30% fidelidad) | 🟡 Media-baja | Ninguna nueva | Ninguna | 🟡 Medio-alto — a diferencia de Evolución/Sueño, estas 6 pantallas son estados de error de una función que **no tiene ningún rastro real en la app** (ni cámara de comida, ni escaneo, ni offline) — un shell aquí se siente más a "relleno de paridad" que en Evolución, donde al menos el registro manual de datos sí existe de verdad | M-L |

**Por qué la fidelidad honesta es más baja aquí que en Evolución (30% vs. 55%):** en Evolución, el usuario ya registra entrenamientos y mediciones de verdad — el "gap" es solo la automatización/IA encima de datos reales. En Nutrición, 3 de las 6 pantallas (cámara, código de barras, low-confidence) no tienen ningún dato real detrás en absoluto — mostrarlas, aunque sea deshabilitadas, es más cercano a documentar una intención de producto que a completar una función parcial.

---

## 4. S4-ProgressAchievements (1 pantalla)

**Pantalla restante:** 142:6022, nodo único, sin catalogar en detalle todavía (no se ha traído el diseño completo de Figma para este documento — estimación basada en el nombre y la descripción ya auditada: "logros/progreso").

| Vía | Ganancia estimada | Complejidad | Dependencias técnicas | Dependencias de producto | Riesgo | Tiempo relativo |
|---|---|---|---|---|---|---|
| **Funcional, real, derivada de datos existentes** | ~0.75 pts (~78%, estimado sin ver el diseño exacto) | 🟢 Baja — **corrección respecto a `docs/NEXT_PARITY_OPPORTUNITIES.md`**, que estimaba "modelo `Achievement` nuevo": los logros pueden calcularse en vivo contando datos que ya existen (`WorkoutSession` completadas, `Recipe` guardadas, racha de Escuadrón, mediciones de `BodyMetric`) — **no requiere ninguna tabla nueva**, solo un endpoint de agregación de solo lectura | Ninguna nueva | Elegir qué 3-5 logros mostrar y su umbral exacto (ej. "10 entrenamientos completados") — decisión de producto pequeña y autocontenida, no bloqueante | 🟢 Bajo | S |

**Condición:** esta estimación asume que los "logros" de Figma son del tipo "hito alcanzado" (contable, verificable) y no insignias decorativas con nombres de fantasía sin criterio claro — **no se ha traído el diseño real todavía**, así que la fidelidad podría bajar si Figma muestra logros que no se pueden mapear a un hito real y verificable sin inventar criterios.

---

## Comparación directa (solo la vía más eficiente de cada bloque)

| Bloque | Pantallas | Ganancia estimada | Complejidad | Riesgo | Tiempo relativo | Dependencias bloqueantes |
|---|---|---|---|---|---|---|
| **4 — S4-ProgressAchievements** | 1 | **~0.75 pts** | 🟢 Baja | 🟢 Bajo | **S** | Ninguna |
| **2 — Sueño (parcial: Fuentes y Diagnóstico + Preparar Descanso)** | 2 de 4 | ~1.2 pts | 🟡 Media | 🟡 Medio | M | Ninguna (2 de 4 quedan bloqueadas) |
| 1 — Evolución (shell honesto) | 5 | ~2.6 pts | 🟢 Baja (shell) / 🔴 Alta (funcional) | 🟡 Medio | M | Ninguna para el shell |
| 3 — Nutrición (shell honesto) | 6 | ~1.7 pts | 🟡 Media | 🟡-🔴 Medio-alto | M-L | Ninguna para el shell |

## Recomendación

**Por puntos absolutos:** el bloque de Evolución en su vía "honesta simplificada" (~2.6 pts, 5 pantallas) es el que más paridad suma de los cuatro. **Pero no es la recomendación por esfuerzo real** — construir 5 shells informativos de alta fidelidad visual (fieles al layout de Figma, con copy cuidadosamente honesto para no insinuar funcionalidad que no existe) es más trabajo que una sola pantalla derivada de datos reales.

**Por retorno de paridad sobre esfuerzo (lo que se pidió):**

1. **S4-ProgressAchievements primero.** Una sola pantalla, ~0.75 pts, complejidad baja, cero dependencias bloqueantes, sin necesidad de "simplificar" nada — es una pantalla que se puede construir **funcionalmente real**, no un shell. Es el mejor ratio punto-por-esfuerzo de los cuatro bloques. Único paso previo: traer el diseño real de Figma para confirmar que los logros mostrados son mapeables a hitos verificables (si no lo son, se documenta como gap parcial en vez de inventar criterios).
2. **Sueño: solo Fuentes y Diagnóstico** (real, ~0.75 pts, complejidad baja) — Preparar Descanso es opcional después, de menor certeza (~0.45 pts, más riesgo de parecer más funcional de lo que es). Seguimiento Activo y Conectar Oura quedan descartados bajo cualquier vía honesta.
3. **Evolución (shell honesto), si se quiere un bloque más grande de una vez.** Mayor ganancia absoluta (~2.6 pts) que Nutrición, mismo patrón ya validado en este proyecto (S1-EmptyEvolution), y a diferencia de Nutrición, describe gaps sobre una función que sí tiene datos reales detrás (menor riesgo de sentirse "relleno").
4. **Nutrición, el último.** Misma cantidad de pantallas que Evolución pero menor fidelidad honesta alcanzable (~30% vs. ~55%) porque ninguna de las 6 tiene ningún dato real detrás — es el bloque con peor relación esfuerzo/autenticidad de los cuatro.

No se implementó código ni se hicieron commits — documento puramente analítico, a la espera de que se elija el bloque.
