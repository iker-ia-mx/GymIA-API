# Plan Maestro: GymIA-Mobile-App → Paridad Total con Figma

**Fecha:** 2026-09-24
**Objetivo declarado:** El Figma (`fileKey=O4cXfRJ7qCbKuH3Jdon00k`, página "Final-Pro") es la fuente de verdad absoluta. Meta: 100% de paridad visual y funcional. No se agrega nada que no esté en Figma; no se omite nada que sí esté.

**Relación con `FIGMA_GAP_ANALYSIS.md`:** ese documento auditó 13 pantallas que yo mismo había asumido como "el alcance". Este documento reemplaza esa asunción: el archivo de Figma contiene **muchas más pantallas** de las que se habían considerado. `FIGMA_GAP_ANALYSIS.md` sigue siendo válido como detalle pixel-a-pixel de esas 13 pantallas — aquí se referencia, no se repite.

---

## 0. Metodología y limitaciones de esta auditoría

1. El inventario se generó parseando el dump de metadata de Figma (`get_metadata` de toda la página), filtrando nodos `<frame>` con dimensiones de pantalla móvil (340–450 × 650–950 px) y excluyendo nodos `AI-FLOW::*` (son diagramas de flujo del propio diseñador, no pantallas a implementar) y wrappers internos genéricos (`Frame`, `Content`, `AppBackground-Wrapper`, `scroll-container`, etc.).
2. Esto dio **5,796 frames totales** en el archivo, de los cuales **276 coinciden con dimensiones de pantalla**. Tras deduplicar wrappers y nodos repetidos, quedan **~91 pantallas con nombre único identificable**, agrupadas en 12 secciones del archivo.
3. **Limitación honesta:** 12 nodos (8 en la sección 138, 4 en la sección 142) están nombrados genéricamente `"nutricion"` en el árbol de capas de Figma — Figma no les dio un nombre descriptivo. No se les puede asignar un rol sin abrir cada uno individualmente con `get_screenshot`. Se listan como **pendientes de identificación**, no se inventa su contenido.
4. Este documento es un **inventario + plan**, no una auditoría pixel-a-pixel de cada pantalla nueva — eso no es posible sin antes construirlas (no hay nada que comparar todavía). Para pantallas que **ya existen** en la app, remito al detalle ya hecho en `FIGMA_GAP_ANALYSIS.md` en vez de duplicarlo.
5. Las 24 pantallas actuales de la app fueron cruzadas contra el inventario por nombre/ruta. Donde el mapeo no es 1:1 obvio, se marca explícitamente como "mapeo incierto" en vez de asumir.

---

## 1. Inventario completo por módulo

### 1.1 Onboarding — **✅ Implementado (Fase 1, 2026-09-24)** — excepto w13-descanso (fuera de alcance)

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| 111:6165 | s00-splash | ✅ Existe (`src/splash.tsx`) |
| 111:5852 | w01-bienvenida | ✅ Implementado — `(auth)/index.tsx`, pantalla de entrada pre-auth |
| 111:5884 | w02-objetivo-experiencia | ✅ Implementado — `(onboarding)/objetivo.tsx` (Paso 1 de 4) |
| 111:5956 | w03-disponibilidad | ✅ Implementado — `(onboarding)/disponibilidad.tsx` (Paso 2 de 4) |
| 111:6026 | w04-gimnasio-equipo | ✅ Implementado — `(onboarding)/equipo.tsx` (Paso 3 de 4) |
| 111:6099 | w05-preferencias | ✅ Implementado — `(onboarding)/preferencias.tsx` (Paso 4 de 4) |
| 111:7846 | w13-descanso | ❌ Deliberadamente excluido — ligado al módulo Sueño (§1.7), fuera de alcance por instrucción explícita del usuario |
| 111:6171 | "05 Generando tu plan" | ✅ Implementado — `(onboarding)/generando.tsx` |

**Backend:** nuevo modelo `OnboardingProfile` + `User.onboardingCompletedAt` (migración aditiva aplicada), módulo `POST /onboarding/complete`. La rutina inicial es real: se genera con una selección determinista sobre el catálogo de ejercicios existente (prioriza grupos musculares elegidos, respeta "conservar"/"evitar", sets/reps según objetivo) y queda persistida y editable — no es un dato simulado ni requiere IA real, algo que se documenta aquí para que quede explícito. Gating de 3 estados en `_layout.tsx`: `(auth)` sin sesión, `(onboarding)` con sesión y sin completar, `(app)` con ambos. Validado end-to-end en vivo (registro → 4 pasos → rutina generada → verificado en base de datos → usuario de prueba eliminado).

**Gap conocido, no bloqueante:** el modelo `Routine` actual no soporta splits multi-día (un plan A/B/C distinto por día de la semana) — la rutina generada es una única lista de ejercicios, no un calendario semanal completo. Documentado aquí en vez de simularlo.

### 1.2 Auth — **~85% de lo existente, con estados faltantes**

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| 111:6262 | Login | ✅ Existe (`(auth)/login.tsx`) |
| 111:6320 | Login — Error | ⚠️ Parcial — la app muestra el error inline (texto rojo bajo el form), Figma puede tener un tratamiento visual distinto (a verificar con `get_design_context` en implementación) |
| 111:6359 | Register | ✅ Existe (`(auth)/register.tsx`) |
| 111:6419 | Forgot Password | ✅ Existe (`(auth)/forgot-password.tsx`) — nota: hoy comunica honestamente que no hay backend de recuperación (ver §4) |
| 111:6570 | correo-enviado | ❌ Falta (estado de éxito tras enviar recuperación — depende de backend, ver §4) |
| 111:6600 | cuenta-creada | ❌ Falta (confirmación post-registro) |
| 111:6628 | verificar-correo | ❌ Falta (depende de backend de verificación de email) |
| 111:6658 | enlace-expirado | ❌ Falta (depende de backend) |
| 111:6688 | correo-ya-registrado | ⚠️ Parcial — hoy es un mensaje de error inline (`Email already in use` traducido), Figma lo trata como pantalla dedicada |

### 1.3 Estados de sistema (conectividad / sesión / notificaciones) — **✅ 11/16 implementados (Fase 1, 2026-09-24)**

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| 111:6445 | no-internet | ✅ Implementado — `src/app/sistema/no-internet.tsx`, disparado por detección real de conectividad (`@react-native-community/netinfo`), no simulado |
| 111:6472 | conexion-inestable | ✅ Implementado — `sistema/conexion-inestable.tsx`, mismo mecanismo (`isConnected && !isInternetReachable`) |
| 111:6499 | servidor-no-disponible | ✅ Implementado — `sistema/servidor-no-disponible.tsx`, disparado por un 5xx real del backend en `apiRequest` |
| 111:6529 | error-generando-sistema | ✅ Implementado — reutilizado dentro de `(onboarding)/generando.tsx` como su estado de error (mismo componente `SystemStateScreen`, no una ruta aparte porque es un estado del mismo flujo, no una pantalla alcanzable desde otro lugar) |
| 111:6722 | sesion-expirada | ✅ Implementado — `sistema/sesion-expirada.tsx`. Reemplaza el `clearSession()` silencioso anterior en el fallo de refresh token: ahora se muestra esta pantalla antes de cerrar la sesión |
| 111:6751 | modo-offline | ✅ Implementado — `sistema/modo-offline.tsx`, alcanzable desde el botón secundario de no-internet |
| 111:6778 | sincronizacion-pendiente | ❌ Omitido — **gap de backend real**: implica una cola de sincronización offline que no existe (soporte offline fuera de alcance por instrucción explícita). Documentado en §4, no simulado |
| 111:6803 | cerrar-sesion (confirmación de logout) | ✅ Implementado — `sistema/cerrar-sesion.tsx`, reemplaza el logout directo desde `perfil/index.tsx` |
| 111:6828 | sin-entrenamientos (empty state) | ✅ Implementado — estado completo de `entrenar/index.tsx` cuando `routines.length === 0 && !activeSession` |
| 111:6857 | sin-comidas (empty state) | ✅ Implementado — estado completo de `nutricion/index.tsx` cuando `meals.length === 0` |
| 111:6886 | sin-datos-de-sueno (empty state) | ❌ Omitido deliberadamente — depende del módulo Sueño (§1.7), fuera de alcance |
| 111:6915 | sin-progreso (empty state) | ✅ Implementado — estado completo de `evolucion/index.tsx` cuando no hay sesiones ni récords recientes |
| 111:6944 | permitir-notificaciones | ✅ Implementado — `sistema/permitir-notificaciones.tsx`, pide el permiso real del sistema operativo (`expo-notifications`). Sin backend de push (ningún token se registra), así que la app queda lista para ese servicio futuro sin fingir que ya envía notificaciones — ver §4 |
| 111:6969 | conectar-salud | ❌ Omitido — depende de integración con servicios de salud externos, ligado al módulo Sueño, fuera de alcance |
| 111:6997 | premium-caducado | ❌ Omitido — depende de sistema de pagos, fuera de alcance |
| 111:7027 | pago-fallido | ❌ Omitido — depende de sistema de pagos, fuera de alcance |

**Componente compartido:** las 11 implementadas reutilizan un único componente `SystemStateScreen` (icono + título + subtítulo + tarjeta de estado opcional + botón primario/secundario), fiel al patrón que Figma repite en las 16 pantallas de esta sección.

**Ajustes deliberados de honestidad (no simplificación de diseño, sino no-invención de datos):** en 3 pantallas el copy original de Figma implica una capacidad que no existe (persistencia offline real). Se omitió o ajustó ese texto puntual manteniendo el resto del diseño intacto:
- `no-internet`: se omite la tarjeta "tus datos se guardarán localmente" (implica guardado offline inexistente).
- `modo-offline`: se omite la tarjeta "tus entrenamientos y progresos se guardarán localmente" (mismo motivo).
- `sesion-expirada`: "Tus datos locales están seguros" → "Tus datos en el servidor están seguros" (la app no tiene datos locales persistentes; sí es cierto que los datos en el servidor están intactos).
- `permitir-notificaciones`: "recordatorios inteligentes y seguimiento de hábitos" → "recordatorios para no perder el ritmo de tu entrenamiento" (no existe motor de recordatorios inteligentes ni tracking de hábitos, solo el permiso de OS).

### 1.4 Entrenar — **✅ Completado (Fase 1, 2026-09-24)**

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| — | index, new-routine, session, summary | ✅ Existen |
| 111:5186 | swap-workout | ✅ Implementado — `entrenar/swap-workout.tsx`. Alcanzable desde "Cambiar rutina" en `entrenar/index.tsx`. Abandona la sesión activa (si existe) y arranca una nueva con la rutina elegida, usando el nuevo endpoint `POST /workouts/sessions/:id/abandon` |
| 111:5312 | all-routines | ✅ Implementado — `entrenar/all-routines.tsx`. Alcanzable desde "Ver todas" en `entrenar/index.tsx` cuando hay rutinas. Usa `lastSessionAt` real (última sesión iniciada con esa rutina), no un dato inventado |
| 111:5475 | detailed-progress | ✅ Implementado — `entrenar/detailed-progress.tsx`. Alcanzable desde cada ejercicio en "Hitos por Ejercicio Principal" (`evolucion/strength.tsx`), pasando `exerciseId` |
| 111:5616 | full-history | ✅ Implementado — `entrenar/full-history.tsx`. Alcanzable desde el shortcut "Historial" en `evolucion/index.tsx` (antes deshabilitado, ahora habilitado y enrutado) |

**Backend:** `GET /workouts/sessions` (lista con filtro opcional `from`/`to`), `POST /workouts/sessions/:id/abandon`, `Routine.lastSessionAt` calculado desde la sesión más reciente, `ExerciseHistory` extendido con `sessionHistory`/`totalSessions` para el detalle por ejercicio. Todo dato real desde Prisma, nada simulado. `tsc --noEmit` limpio en `api` y `mobile`.

### 1.5 Evolución — **3/8 estados de error implementados (Fase 1, 2026-09-24), 5 documentados como gap**

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| 147:5715 | dashboard-evolucion | ✅ Probable = `evolucion/index.tsx` |
| 147:5813 | fuerza-rendimiento | ✅ Probable = `evolucion/strength.tsx` |
| 147:5903 | composicion-corporal | ✅ Probable = `evolucion/cuerpo.tsx` |
| 111:7350 | evolution-history | ⚠️ Mapeo incierto — podría ser `cuerpo-fotos.tsx` o una pantalla nueva de historial general |
| 147:6083 | S1-EmptyEvolution | ✅ Implementado — reemplaza el `SystemStateScreen` genérico que cubría el estado vacío de `evolucion/index.tsx` (Fase 1 anterior) por el diseño real de Figma: tarjeta "Evolución Desactivada" con 2 CTAs reales (`entrenar/new-routine`, `evolucion/cuerpo-agregar`) + sección "Métricas en Espera" con badge "0% DATOS" real y bloques skeleton decorativos. Ajuste de honestidad: se omitió la cláusula "...y estimar tu adherencia" del copy original (la adherencia no es un dato calculado, ver gap de `evolucion-error-adherencia` abajo) |
| 147:6161 | S2-SyncError | ❌ **Gap de producto, no implementado** — el diseño completo (título "Sincronización Fallida", botón "Vincular cuenta con Google Fit / Apple Health") asume que los datos de fuerza provienen de sincronizar un dispositivo/wearable externo. La app no tiene ni ha tenido nunca esa capacidad: las sesiones se registran manualmente en la app. Implementarlo tal cual sería fabricar una función de sincronización inexistente. Ver §4 |
| 147:6235 | S3-FormValidations | ✅ Implementado — `evolucion/cuerpo-agregar.tsx` ahora valida en vivo peso (30-250kg) y grasa corporal (0-70%) con borde/texto de error por campo, estilo fiel al diseño, y muestra aviso (no bloqueante) si ya existe una medición hoy. El botón de guardar se deshabilita mientras hay errores. **Campo omitido:** "Altura (Obligatorio para IMC)" — no existe un campo de altura en `BodyMetric` ni en `User`; documentado como gap en §4, no se inventó el campo |
| 147:6320 | S4-ProgressPhotosError | ✅ Implementado — `evolucion/cuerpo-agregar-foto.tsx` ahora distingue permiso de cámara vs. galería denegado (con botón real "Abrir Ajustes" vía `Linking.openSettings()`), valida formato de archivo real (antes un HEIC se re-etiquetaba silenciosamente como JPEG; ahora se rechaza con el mensaje de Figma), y permite reintentar solo la subida fallida sin perder la foto elegida. "Registrar sin foto" enruta a `cuerpo-agregar.tsx` (destino real, ya existente) |
| 150:2859 | evolucion-error-adherencia | ❌ **Gap de producto, no implementado** — depende de un sistema de "rachas"/adherencia (%), un calendario semanal con datos de Sueño/Nutrición, "completar" una sesión retroactiva de un día pasado, y conexión con Apple Health/Google Fit. Ninguno de estos 4 conceptos existe en el backend. Ver §4 |
| 150:2959 | evolucion-error-historial | ❌ **Gap de producto, no implementado** — el diseño completo es "Modo Offline": filtros que requieren conexión, "datos locales" cacheados, borrador sincronizado hace 2 horas. Depende enteramente de soporte offline, ya descartado del MVP en decisiones previas del proyecto. Ver §4 |
| 150:3038 | evolucion-error-insights | ❌ **Gap de producto, no implementado** — "Confianza Baja (30%)" y "Recomendación Contradictoria Detectada" implican un motor de insights de IA con score de confianza que compara volumen de entrenamiento contra datos de sueño/frecuencia cardíaca. No existe ningún motor de insights, score de confianza, ni dato de frecuencia cardíaca en el backend. Ver §4 |
| 150:3110 | evolucion-error-metas-informe | ❌ **Gap de producto, no implementado** — combina 3 capacidades inexistentes: validación de "meta imposible o duplicada" (no hay motor de validación de metas), resolución de conflictos entre dispositivos (iPhone vs. Apple Watch — no hay sincronización multi-dispositivo), y exportación de informe a PDF (no existe generación de PDF). Ver §4 |

### 1.6 Nutrición — el módulo más subestimado en el análisis previo

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| — | index, agregar, historial, resumen | ✅ Existen |
| 111:8644 | s01-context-menu | ❌ Falta (menú de acciones rápidas al agregar comida) |
| 111:8739 | s02-add-food-hub | ❌ Falta (hub de métodos de captura: manual/foto/código de barras) |
| 111:8831 | s03-active-camera | ❌ Falta — **depende de reconocimiento de comida por foto, feature de IA descartada del MVP** (ver §4) |
| 109:5305 / 111:9031 | S2-MyRecipes | ❌ Falta (biblioteca de recetas) |
| 111:10190 / 113:5282 | Screen-4-Detalle-Receta | ❌ Falta |
| 111:10273 / 113:5360 | Screen-5-Metas-Macros | ❌ Falta (configuración de metas de macronutrientes) |
| 111:10355 / 113:5442 | Screen-6-Comidas-Horarios | ❌ Falta (configuración de horarios de comida) |
| 111:10442 / 113:5524 | Screen-7-Privacidad-IA | ❌ Falta (configuración de privacidad de datos usados por IA) |
| 115:4431 | Screen_1_Empty_Day | ❌ Falta |
| 115:4513 | Screen_2_Empty_Library | ❌ Falta |
| 115:4577 | Screen_3_Camera_Denied | ❌ Falta — depende de feature de cámara descartada |
| 115:4646 | Screen_4_Barcode_Error | ❌ Falta — **depende de escaneo de código de barras, feature descartada del MVP** |
| 115:4718 | Screen_5_Search_Empty_Offline | ❌ Falta — depende de soporte offline, descartado del MVP |
| 115:4789 | Screen_6_AI_Vision_Low_Confidence | ❌ Falta — depende de reconocimiento por foto |
| 115:4858 | Screen_7_Form_Validation_Error | ❌ Falta (validación de formulario, sin dependencia nueva) |
| 115:4931 | Screen_8_Sync_Conflicts_Complete | ❌ Falta — depende de sincronización offline |
| 138:xxxx ×8 | "nutricion" (sin nombre descriptivo) | ⚠️ **Pendiente de identificar** — requiere `get_screenshot` individual antes de poder planificarlas |

### 1.7 Sueño / Descanso — **módulo enteramente nuevo, nunca antes mencionado en este proyecto**

| Nodo Figma | Pantalla |
|---|---|
| 160:2968 | preparar-descanso |
| 160:3055 | seguimiento-activo |
| 171:2860 | sueño-conectado-inicio |
| 171:3104 | conectar-dispositivo |

**Esto no existe en absoluto hoy:** ni tab, ni ruta, ni modelo de datos en el backend, ni concepto en ningún documento previo del proyecto. Requiere decisión de producto explícita antes de planificar implementación (ver §4).

### 1.8 Perfil — más grande de lo auditado en `FIGMA_GAP_ANALYSIS.md`

| Nodo Figma | Pantalla | Estado en app |
|---|---|---|
| 142:5712 | S1-ProfileHome | ⚠️ Parcial — `perfil/index.tsx` (antes `perfil.tsx`, convertido a stack para poder anidar `objetivos.tsx`) cubre una versión reducida (avatar, email, stats, logout + nuevo enlace a Objetivos y Preferencias). Figma probablemente tiene más secciones. |
| 142:5928 | S3-GoalsPreferences | ⚠️ **Implementado parcialmente (Fase 1, 2026-09-24)** — `perfil/objetivos.tsx`, nueva pantalla, alcanzable desde "Objetivos y Preferencias" en `perfil/index.tsx`. Meta Principal (editable, real), Frecuencia y Equipamiento (de solo lectura, reales, calculados de `OnboardingProfile`) y Enfoque de Grupo Muscular (editable, real) están implementados y escriben a un endpoint nuevo `PATCH /onboarding/profile`. **Ajuste de honestidad:** Figma etiqueta la meta principal como "Recomposición / Fuerza Máxima / Definición Extrema" y el enfoque muscular incluye "Tríceps" — ninguna de esas etiquetas existe en el modelo real (`OnboardingProfile.goal` tiene 3 valores distintos: ganar_musculo/ganar_fuerza/fuerza_musculo, y `musclePriorities` usa 5 grupos: Pecho/Espalda/Piernas/Hombros/Brazos, ya establecidos en el cuestionario de onboarding). Se usaron las etiquetas reales en vez de inventar una tabla de conversión entre dos taxonomías no confirmada. **Tarjeta omitida:** "Preferencias de Nutria IA" (badge "IA OPTIMIZED" + texto de razonamiento del algoritmo del día) — no existe motor de IA que genere esa explicación ni una clasificación de "tipo de dieta"; `NutritionGoal` solo guarda números de macros. Documentado como gap en §4 |
| 142:6022 | S4-ProgressAchievements | ❌ Falta (logros/progreso) — pospuesta a Fase 3, depende de un modelo `Achievement` nuevo (ver plan original) |
| 142:xxxx ×4 | "nutricion" (sin nombre descriptivo) | ⚠️ **Pendiente de identificar** |

---

## 2. Resumen de módulos completamente nuevos (no existen ni parcialmente hoy)

1. ~~**Onboarding**~~ (§1.1) — 10 pantallas. ✅ Hecho (Fase 1, turno anterior).
2. ~~**Sistema de estados de conectividad/sesión/vacíos**~~ (§1.3) — ✅ 11/16 construidas (Fase 1); quedan 5 sin construir por depender de módulos fuera de alcance (offline sync, Sueño, pagos).
3. **Sueño/Descanso** (§1.7) — 4 pantallas, 0 construidas, sin modelo de datos backend.
4. **Recetas y configuración avanzada de Nutrición** (§1.6, subset) — 5 pantallas.
5. **Estados de error de Evolución** (§1.5, subset) — 8 pantallas. ✅ 3/8 hechas (este turno); 5/8 documentadas como gap de producto (no simple falta de tiempo — dependen de sistemas que no existen: sync con wearable, adherencia/rachas, modo offline, insights de IA, validación de metas + multi-dispositivo + PDF).
6. ~~**Subpantallas de Entrenar**~~ (§1.4) — 4 pantallas. ✅ Hecho (turno anterior).
7. **Perfil extendido** (§1.8, subset) — 1 pantalla (S3-GoalsPreferences). ✅ Implementada parcialmente (este turno) — ver detalle en §1.8. S4-ProgressAchievements sigue pospuesta a Fase 3.
8. **12 pantallas sin identificar** (secciones 138 y 142) — pendientes de un pase de `get_screenshot`.
9. **Módulo "Escuadrón"** (§3) — **nuevo descubrimiento de este turno**: el tab bar de Figma tiene 5 pestañas (Evolución/Entrenar/Nutrición/**Escuadrón**/Perfil) en las ~50 pantallas de las secciones 147/150 inspeccionadas hoy. La app solo tiene 4 tabs — "Escuadrón" no existe en absoluto: ni tab, ni ruta, ni mención previa en ningún documento del proyecto. Mismo tipo de gap que Sueño/Descanso (§1.7): un módulo entero (probablemente social/comunidad, a juzgar por el ícono de personas) que Figma diseñó pero el proyecto nunca decidió construir. No se agregó el tab — hacerlo sin backend sería un botón sin destino real. Ver §4.

---

## 3. Componentes y navegación faltantes

- ~~**Flujo de onboarding completo**~~ ✅ Hecho (Fase 1) — grupo `(onboarding)/`, gating de 3 estados en `_layout.tsx`, `onboardingCompletedAt` en `User`.
- ~~**Sistema de componentes de estado vacío/error reutilizable**~~ ✅ Hecho (Fase 1) — componente `SystemStateScreen` (`src/components/system/`), usado por las 11 pantallas de sistema implementadas.
- ~~**Subpantallas de Entrenar**~~ ✅ Hecho (turno anterior) — `swap-workout`, `all-routines`, `detailed-progress`, `full-history`, todas enrutadas desde un destino real (no botones huérfanos).
- ~~**Sub-stack de Perfil**~~ ✅ Hecho (este turno) — `perfil.tsx` se convirtió en `perfil/` (`_layout.tsx` con `<Stack>`, `index.tsx`, `objetivos.tsx`), mismo patrón que `entrenar/_layout.tsx`.
- ~~**3/8 estados de error de Evolución**~~ ✅ Hecho (este turno) — S1-EmptyEvolution, S3-FormValidations, S4-ProgressPhotosError. Los 5 restantes son gap de producto, no de componente (ver §1.5, §4).
- **Tab de "Escuadrón"** — **nuevo hallazgo de este turno** (ver §2, ítem 9): Figma diseñó un 5º tab que no existe en la app. No implementado — requiere decisión de producto sobre qué es ese módulo antes de construir ni siquiera el tab vacío.
- **Tab de Sueño** en el tab bar, si el módulo se aprueba (ver §4) — hoy el tab bar solo tiene Entrenar/Evolución/Nutrición/Perfil.
- **Hub de captura de comida** (`s02-add-food-hub`) como pantalla intermedia antes de `agregar.tsx`, con ramas hacia cámara/código de barras/manual.
- **Contenedor de recetas** como sub-stack de Nutrición (patrón ya usado: `entrenar/_layout.tsx` como `<Stack>` anidado dentro del tab).

---

## 4. Dependencias de backend — gaps documentados, sin datos inventados

Por regla explícita del usuario: donde falta dato de backend, se documenta el gap y se propone el cambio necesario. No se implementa ninguna de estas pantallas con datos falsos.

| Pantalla(s) Figma | Dato/capacidad que falta en backend | Cambio propuesto |
|---|---|---|
| correo-enviado, verificar-correo, enlace-expirado | No existe flujo de recuperación de contraseña ni verificación de email | Nuevo módulo `PasswordReset` (tabla de tokens de un solo uso + expiración, endpoint `POST /auth/forgot-password`, `POST /auth/reset-password`) y `EmailVerification` análogo. Requiere proveedor de envío de correo (hoy no hay ninguno integrado). |
| onboarding (w01–w05, w13-descanso, "Generando tu plan") | No existe campo que distinga "usuario registrado, onboarding pendiente" de "onboarding completo", ni tabla para guardar las respuestas del cuestionario (objetivo, disponibilidad, equipo, preferencias) | Agregar `onboardingCompletedAt: DateTime?` a `User`, y una tabla `OnboardingProfile` (objetivo, experiencia, disponibilidad, equipo disponible, preferencias) que además alimenta la generación de rutina inicial |
| s03-active-camera, Screen_6_AI_Vision_Low_Confidence | Reconocimiento de comida por foto (IA de visión) — **explícitamente fuera del MVP en decisiones previas del proyecto** | Requiere decisión de producto: ¿se reintegra esta feature al alcance? Si sí, se necesita un servicio de visión (no trivial: costo de inferencia, proveedor). No se debe simular con datos falsos. |
| Screen_4_Barcode_Error (implica escaneo de código de barras) | Escaneo de barras — **explícitamente fuera del MVP** | Requiere integración con una base de datos de productos por código de barras (ej. Open Food Facts) + librería de escaneo en el cliente. Decisión de producto pendiente. |
| Screen_5_Search_Empty_Offline, sincronizacion-pendiente, Screen_8_Sync_Conflicts_Complete, modo-offline | Soporte offline con sincronización — **explícitamente fuera del MVP** | Requiere cola de sincronización local + resolución de conflictos en backend. Cambio arquitectónico grande, no incremental. |
| Sueño/Descanso (4 pantallas) | No existe ningún modelo de datos de sueño, ni integración con wearables/HealthKit/Google Fit | Nuevo módulo backend `SleepLog` (duración, calidad, fuente) + decisión de producto sobre qué proveedor de datos de salud integrar (Apple HealthKit / Google Fit / dispositivo propio). Este es el gap más grande del plan: no hay nada construido, ni decidido, en ningún nivel. |
| conectar-salud, sueño-conectado-inicio, conectar-dispositivo | Integración con servicios de salud externos (OAuth con Apple Health / Google Fit / wearables) | Requiere flujo de autorización externo y almacenamiento de tokens de terceros — cambio de infraestructura, no solo de UI. |
| premium-caducado, pago-fallido | No existe sistema de suscripciones/pagos en absoluto | Requiere integración de pagos (ej. RevenueCat/Stripe), modelo `Subscription`, webhooks de estado de pago. Fuera de alcance hasta que se decida el modelo de negocio de la app. |
| S1-ProfileHome, S4-ProgressAchievements | "Logros" no tiene modelo de datos — no hay tabla de achievements/badges | Si se confirma el alcance, requiere tabla `Achievement` + lógica de qué desbloquea cada uno. **No inventar logros ficticios en el cliente.** |
| S2-SyncError (evolución) | Sincronización de datos de fuerza con wearable (Google Fit / Apple Health) — la app no tiene ni ha tenido esta capacidad | Mismo gap que conectar-salud (fila anterior): requiere integración de salud externa. Sin eso, no hay nada que "falle al sincronizar" — se recomienda no implementar este estado hasta que exista la integración real |
| evolucion-error-adherencia | No existe % de adherencia, "rachas" de días consecutivos, calendario de registro diario, ni opción de completar una sesión retroactiva (backdated) | Requiere: (1) definir y calcular una fórmula de adherencia real sobre `WorkoutSession`, (2) un campo/lógica de racha, (3) un endpoint para crear una sesión con `startedAt`/`finishedAt` en el pasado. Los 2 primeros son decisión de producto (qué cuenta como "día cumplido"); el 3º es técnicamente simple una vez decidido |
| evolucion-error-historial | Modo offline con caché local de gráficos e indicador de "sincronizado hace N horas" | Mismo gap que soporte offline (fila de arriba) — requiere cola/caché local, fuera de alcance del MVP |
| evolucion-error-insights | Motor de "insights de IA" con score de confianza (%) y detección de contradicciones entre volumen de entrenamiento y frecuencia cardíaca/sueño | No existe ningún modelo de recomendación ni dato de frecuencia cardíaca en el backend. Requiere decisión de producto: ¿se construye un motor de reglas (no IA real) que compare métricas existentes, o se descarta como el resto de features de "IA real" ya fuera de alcance? |
| evolucion-error-metas-informe | (1) Validación de "meta imposible o duplicada", (2) resolución de conflictos entre dispositivos, (3) exportación de informe a PDF | (1) requiere reglas de validación sobre un futuro modelo de metas; (2) requiere sincronización multi-dispositivo (no existe ningún concepto de "dispositivo" en el backend); (3) requiere una librería de generación de PDF en el cliente o servidor. Tres capacidades independientes, ninguna construida |
| S3-GoalsPreferences → tarjeta "Preferencias de Nutria IA" | Texto de razonamiento generado dinámicamente ("calibrado para reparar fibras... en base a tu entrenamiento activo de hoy") y una clasificación de "tipo de dieta" (ej. "Dieta Hiperproteica") | `NutritionGoal` solo guarda `dailyCaloriesKcal`/`proteinG`/`carbsG`/`fatG` — números, no una clasificación ni texto generado. Requiere: (1) un campo de tipo de dieta derivado de esos macros, y (2) opcionalmente una plantilla de texto (no IA real) que combine el tipo de dieta con si hay una sesión activa hoy. Se omitió la tarjeta en vez de fabricar el texto |
| S3-FormValidations (evolución) → campo "Altura" | No existe campo de altura en `BodyMetric` ni en `User`, necesario para calcular IMC | Agregar `heightCm` a `BodyMetric` (o a `User`, si la altura es constante por usuario en vez de por medición) — migración aditiva simple, sin decisión de producto pendiente, pero fuera del alcance de "estados de error" por lo que se propone y no se implementó unilateralmente |
| Tab "Escuadrón" (§2, ítem 9; visible en el bottom-nav de ~50 pantallas de las secciones 147/150) | No existe absolutamente nada: ni tab, ni ruta, ni modelo de datos, ni mención previa en el proyecto. Por el ícono (personas) probablemente es una feature social/comunidad (retos entre amigos, comparar progreso, etc.) | Requiere decisión de producto explícita sobre qué es "Escuadrón" antes de poder estimar nada — mismo tratamiento que Sueño/Descanso. No se agregó el tab vacío para no crear un botón sin destino real |
| ~~Estados "sin-progreso", "sin-entrenamientos", "sin-comidas"~~ | Sin dependencia de backend | ✅ Implementado (Fase 1) — detección de arrays vacíos + `SystemStateScreen` |
| sin-datos-de-sueno | Depende del módulo Sueño (§1.7) | Sin cambio — omitido hasta que se decida el alcance de Sueño |
| ~~no-internet, conexion-inestable, servidor-no-disponible, error-generando-sistema, sesion-expirada, modo-offline, cerrar-sesion, permitir-notificaciones~~ | Sin dependencia de backend nueva | ✅ Implementado (Fase 1) — `@react-native-community/netinfo` para conectividad real, 5xx real del backend para servidor-no-disponible, fallo real de refresh token para sesión expirada, `expo-notifications` para el permiso real de notificaciones |
| 12 pantallas "nutricion" sin identificar (§1.6, §1.8) | Desconocido hasta identificar el contenido real | No se puede evaluar dependencia de backend sin antes hacer `get_screenshot` de cada nodo |

**Resumen de decisiones de producto pendientes (no técnicas):** Sueño/Descanso, reconocimiento de comida por foto, escaneo de código de barras, soporte offline, sistema de premium/pagos, y ahora también **adherencia/rachas, insights de IA, validación de metas + sync multi-dispositivo, y el módulo "Escuadrón"** son funcionalidades completas que Figma diseñó pero que el proyecto nunca decidió construir. La regla del usuario ("si existe en Figma, debe implementarse") entra en tensión directa con eso. Esto se señala aquí en vez de decidir unilateralmente — son ahora 9 features con costo de backend no trivial, varias con dependencias externas (proveedor de IA de visión, de pagos, de datos de salud) o con decisiones de producto que ni siquiera tienen una primera definición (¿qué es "Escuadrón"? ¿qué cuenta como adherencia?).

---

## 5. Porcentaje de avance real

**Metodología:** de las ~91 pantallas únicas identificadas (excluyendo las 12 aún sin nombre), ahora existen 49 en la app:
- 24 de la línea base anterior, con fidelidad medida en `FIGMA_GAP_ANALYSIS.md` de ~72% (Sprint Figma Parte 1).
- 6 de Onboarding (Fase 1, turno anterior).
- 11 de Estados de sistema (Fase 1, turno anterior).
- 4 de Subpantallas de Entrenar (Fase 1, turno anterior): `swap-workout`, `all-routines`, `detailed-progress`, `full-history`.
- 4 de este turno: **S1-EmptyEvolution**, **S3-FormValidations** y **S4-ProgressPhotosError** (Evolución), y **S3-GoalsPreferences** (Perfil, parcial — ver §1.8).

Las primeras 21 (Onboarding + Estados de sistema + Entrenar) se implementaron con `get_design_context`/`get_screenshot` como referencia visual, verificadas en vivo contra esas capturas; se les asigna conservadoramente ~90%. Las 4 de este turno también se construyeron con `get_design_context`/`get_screenshot` real, pero con más reinterpretación necesaria (etiquetas de meta/grupo muscular corregidas a las reales del backend, una tarjeta completa omitida en Perfil, un campo omitido en el formulario de medición) — se les asigna ~85%, un punto por debajo del bloque anterior, para reflejar esa brecha adicional sin inflar la cifra:

```
Pantallas existentes:              49 / 91  ≈ 54%
Fidelidad promedio (24 @ 72% medido + 21 @ 90% + 4 @ 85% verificado visualmente):
  (24 × 0.72 + 21 × 0.90 + 4 × 0.85) / 49 ≈ 80.8%
Avance real ponderado:              49 × 0.808 / 91 ≈ 43.5%
```

**Avance real estimado: ~43-44% de paridad total con Figma** (subió de ~40% antes de este turno, ~19% antes de Fase 1).

El salto de este turno es real pero parcial frente al objetivo original de "Evolución + Perfil completos": de las 9 pantallas que se intentaron (8 de Evolución + 1 de Perfil), **4 se construyeron con datos reales** y **5 se documentaron como gap de producto** porque su diseño depende de sistemas que sencillamente no existen en el backend (sync con wearable, adherencia/rachas, modo offline, insights de IA, validación de metas con sync multi-dispositivo y export a PDF — ver §1.5 y §4). Además se descubrió un módulo entero nuevo ("Escuadrón", un 5º tab presente en todo el archivo de Figma) que tampoco existe en la app — ver §2 y §4. Quedan ~42 pantallas identificadas sin construir más las 12 sin identificar.

---

## 6. Orden exacto de implementación propuesto

Criterio de orden: impacto en el usuario × ausencia de dependencia de backend nueva. Las fases con dependencias de producto no resueltas (§4) se colocan al final, no porque no importen sino porque no pueden empezar sin una decisión.

**Fase 1 — Sin dependencia de backend nueva, alto impacto (más rápida de ejecutar):**
1. ~~Onboarding (w01–w05)~~ ✅ **Hecho** (turno anterior) — backend incluido (`OnboardingProfile`, generación real de rutina inicial).
2. ~~Sistema de estados vacíos (sin-entrenamientos, sin-comidas, sin-progreso)~~ ✅ **Hecho** (turno anterior).
3. ~~Sistema de estados de conectividad (no-internet, conexion-inestable, servidor-no-disponible, sesion-expirada, modo-offline, cerrar-sesion, permitir-notificaciones)~~ ✅ **Hecho** (turno anterior) — 7 pantallas más de lo mínimo listado aquí originalmente, mismo esfuerzo al compartir el componente `SystemStateScreen`.
4. ~~Subpantallas de Entrenar (swap-workout, all-routines, detailed-progress, full-history)~~ ✅ **Hecho** (turno anterior) — backend nuevo incluido.
5. ~~Estados de error de Evolución (8 pantallas)~~ ✅ **3/8 hechas, 5/8 gap de producto documentado** (este turno) — S1-EmptyEvolution, S3-FormValidations, S4-ProgressPhotosError implementadas; S2-SyncError y las 4 `evolucion-error-*` dependen de sistemas inexistentes (ver §1.5, §4). No queda trabajo pendiente aquí sin antes resolver esas dependencias.
6. ~~Perfil extendido (S3-GoalsPreferences)~~ ✅ **Implementada parcialmente** (este turno) — Meta/Frecuencia/Equipamiento/Grupo Muscular reales y editables; tarjeta "Preferencias de Nutria IA" omitida (gap, ver §4). S4-ProgressAchievements se mantiene pospuesta a Fase 3.

**Fase 2 — Requiere cambio de backend acotado (nuevo módulo pequeño, sin decisión de producto pendiente):**
7. Recuperación de contraseña real + verificación de email (correo-enviado, verificar-correo, enlace-expirado, cuenta-creada, correo-ya-registrado) — requiere proveedor de email, pero es una feature estándar sin ambigüedad de producto.
8. Recetas y configuración de Nutrición (S2-MyRecipes, Detalle-Receta, Metas-Macros, Comidas-Horarios, Privacidad-IA) — requiere modelo `Recipe` nuevo, pero sin dependencia externa.
9. Identificar las 12 pantallas "nutricion" sin nombre (pase de `get_screenshot`) y reclasificarlas en este plan.

**Fase 3 — Requiere decisión de producto antes de estimar (no empezar sin resolución explícita del usuario):**
10. Reconocimiento de comida por foto + código de barras (s03-active-camera, Screen_4_Barcode_Error, Screen_6_AI_Vision_Low_Confidence) — decidir si se reintegra al alcance.
11. Soporte offline y sincronización real (sincronizacion-pendiente, Screen_5_Search_Empty_Offline, Screen_8_Sync_Conflicts_Complete — cola de escritura offline con resolución de conflictos; `modo-offline` ya está construido como pantalla informativa ligera, sin persistencia real) — decidir si se reintegra al alcance.
12. Módulo de Sueño/Descanso completo (4 pantallas + backend + integración de salud) — decidir si se reintegra al alcance; es el módulo más grande y menos definido de todos.
13. Sistema de premium/pagos (premium-caducado, pago-fallido) — decidir modelo de negocio antes de construir cualquier UI de pago.

---

## 7. Siguiente paso inmediato

**Fase 1 está completa en el sentido de "todo lo que se puede construir sin una decisión de producto ya se construyó"** — los 6 ítems originales de Fase 1 fueron atendidos: Onboarding, estados vacíos, estados de conectividad/sesión, subpantallas de Entrenar, estados de error de Evolución (3/8, el resto es gap) y Perfil extendido (parcial, un sub-elemento es gap). No queda ningún ítem de Fase 1 bloqueado por falta de acceso a Figma — la autenticación del MCP (`plugin:figma:figma`) se resolvió este turno.

Lo que queda pendiente ya no es "trabajo de Fase 1 sin hacer", sino **decisiones de producto** que determinan si hay más trabajo de Fase 1 o si esas pantallas pasan a Fase 3 junto con Sueño/pagos/offline:
- ¿Se agrega un campo `heightCm` a `BodyMetric` para soportar el cálculo de IMC que pedía S3-FormValidations? (cambio de backend trivial, sin ambigüedad de producto — podría hacerse en cualquier momento)
- ¿Qué es el módulo "Escuadrón" (5º tab, nuevo hallazgo de este turno)? Sin definición no se puede ni siquiera agregar el tab vacío.
- ¿Se define una fórmula de adherencia/rachas, un motor de insights (aunque sea basado en reglas, no IA real), validación de metas, y sync multi-dispositivo? Cuatro decisiones independientes detrás de las 4 pantallas `evolucion-error-*` que no se construyeron.
- ¿Se reintegra la sincronización con Apple Health/Google Fit al alcance? Bloquea tanto S2-SyncError como partes de evolucion-error-adherencia.

Antes de Fase 2, sigue pendiente (sin relación con lo anterior): decidir qué hacer con los 12 nodos "nutricion" sin nombre — requiere un pase de `get_screenshot` individual para identificarlos antes de tocar el módulo de Nutrición.
