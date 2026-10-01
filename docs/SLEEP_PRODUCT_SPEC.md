# Sueño / Descanso — Especificación de Producto (según Figma)

**Fecha:** 2026-09-24
**Fuente:** Figma `fileKey=O4cXfRJ7qCbKuH3Jdon00k`, página "Final-Pro". Este documento es **solo investigación y especificación** — no se implementó nada, no hay commits.

**Cómo se encontró este módulo:** `FIGMA_TO_APP_MASTER_PLAN.md` §1.7 ya tenía 4 nodos catalogados (`160:2968`, `160:3055`, `171:2860`, `171:3104`) desde una pasada anterior, marcados como "módulo enteramente nuevo, nunca antes mencionado en este proyecto". Ese catálogo estaba incompleto — el caso de Escuadrón (`docs/ESCUADRON_PRODUCT_SPEC.md`) ya demostró que la primera pasada de identificación de pantallas fallaba en encontrar contenido agrupado. Este documento reabre la investigación y encuentra **2 pantallas más** (`171:2961` "Apps y Relojes" y `171:3198` "Fuentes y Diagnóstico"), ambas críticas para entender la integración real con wearables — sin ellas, la sección de integraciones de este documento habría sido pura especulación.

**Estructura del contenido en Figma:** existen dos canvases distintos para Sueño:
- **Canvas original** (prefijo de nodo `160:`), con 2 pantallas: `preparar-descanso` (`160:2968`) y `seguimiento-activo` (`160:3055`), ambas hijas de un contenedor no localizado con certeza pese a intentarlo activamente (ver nota de honestidad abajo).
- **Canvas de extensión**, nodo raíz confirmado `171:2859` **`GymIA-Sleep-Canvas-Extensions-Root`**, con 4 pantallas: `sueño-conectado-inicio` (`171:2860`), `apps-y-relojes` (`171:2961`), `conectar-dispositivo` (`171:3104`), `diagnostico-fuentes` (`171:3198`) — confirmadas como hijas directas de ese contenedor, con coordenadas de canvas en una cuadrícula uniforme de 4 columnas espaciadas 422px (x = 48, 470, 892, 1314; y = 48 en las 4).

**Nota de honestidad sobre el canvas original (`160:`):** las coordenadas de `preparar-descanso` (x=470) y `seguimiento-activo` (x=892) encajan exactamente en la misma cuadrícula de 4 columnas del canvas de extensión (48/470/892/1314). Esto sugiere fuertemente que existía (o existe) una tercera pantalla en la posición x=48 y posiblemente una cuarta en x=1314 del canvas original, que **no se pudo localizar** pese a varios intentos de búsqueda por ID de nodo — el archivo no ofrece una herramienta de búsqueda por texto, solo lectura de metadata por ID conocido, y no se encontró el nodo raíz de ese canvas (equivalente al `171:2859` del canvas de extensión). Se documenta esta posible pantalla faltante en vez de inventar su contenido. Las 6 pantallas que sí se confirmaron son suficientes para especificar el módulo con solidez.

**Diagrama `AI-FLOW::*` del diseñador:** `docs/ESCUADRON_PRODUCT_SPEC.md` afirma (de una investigación previa a la de este documento) que sí existe un diagrama de flujo dedicado a Sueño, a diferencia de Escuadrón que no tiene ninguno. **No se pudo relocalizar ese diagrama en esta pasada** — no hay una forma de buscar nodos por nombre en el archivo salvo teniendo ya su ID, y explorar el árbol completo del documento (`get_metadata` sobre la página raíz `0:1`) es inviable por tamaño (~5,796 frames totales, confirmado en `FIGMA_TO_APP_MASTER_PLAN.md` §0). El flujo de la sección 2 de este documento se reconstruyó en su lugar directamente de las 6 pantallas confirmadas — botones con texto explícito ("Iniciar Seguimiento de Sueño →", "¡Comenzar Seguimiento!", "Conectar otro dispositivo Wearable"), chips de navegación hacia atrás ("← Sueño", "← Cancelar", "← Volver") y los 4 enlaces de "Ecosistema Somnia". Es una reconstrucción con buena evidencia (no botones aislados sino un conjunto coherente de 6 pantallas que se referencian entre sí por nombre y contexto), pero no es la fuente primaria del diseñador — se marca así explícitamente donde corresponde.

---

## 1. Objetivo del módulo

Según las 6 pantallas confirmadas, Sueño es un **ecosistema de seguimiento de sueño en tiempo real con preparación guiada y sincronización multi-dispositivo**, con marca propia dentro de la marca: la sección se presenta bajo el nombre **"SOMNIA AI"** (badge visible en `sueño-conectado-inicio`) y "Ecosistema Somnia" como el nombre de la sub-marca. El módulo:

1. Prepara al usuario antes de dormir (alarma inteligente con ventana de despertar en fase óptima, checklist de entorno — temperatura, luz azul, meditación —, control de sonido ambiental).
2. Registra una sesión de sueño activa en tiempo real (fase de sueño, frecuencia cardíaca, movimiento, ruido ambiental, condiciones de entorno) con un elemento visual central tipo "órbita" que representa el ciclo actual.
3. Muestra un resumen post-sueño ("Análisis de Anoche": tiempo en cama, eficiencia, recuperación, calidad de datos).
4. Conecta y gestiona múltiples fuentes de datos: Apple Health, Google Health Connect, y una lista extensa de wearables de terceros (Oura Ring, WHOOP, Garmin Connect, Fitbit, Samsung Health, Polar, Xiaomi Fit, Withings).
5. Da herramientas de diagnóstico cuando hay múltiples fuentes en conflicto (duplicados, prioridad de fuentes, troubleshooting).

En una frase: es el módulo de biometría nocturna de GymIA, pensado para alimentar de datos reales (sueño, HRV, frecuencia cardíaca) tanto al usuario individual como — explícitamente, según el propio copy de Figma — a Evolución y Escuadrón.

## 2. Flujo completo de usuario

**Advertencia explícita:** sin diagrama del diseñador confirmado en esta pasada (ver nota arriba). Reconstrucción basada en las 6 pantallas y sus CTAs/enlaces explícitos.

1. **Tab "Sueño"** (bottom-nav — ver §5 sobre su posición inconsistente) → pantalla raíz de entrada, probablemente `sueño-conectado-inicio` (`171:2860`, "Sueño Conectado — Tu ecosistema de descanso sincronizado"), que muestra: estado de sincronización activo ("Apple Watch • Hace 4m"), el análisis de la noche anterior (7h 45m en cama, 88% eficiencia, 95% recuperación), y 4 accesos de "Ecosistema Somnia": Historial, Reporte, Ajustes, Perfil — **ninguno de estos 4 destinos tiene una pantalla propia confirmada en el archivo** (no se encontraron nodos llamados "historial-sueño", "reporte-sueño" ni "ajustes-sueño"; se documenta como pantallas no localizadas, no como inexistentes con certeza — podrían vivir en la tercera/cuarta posición no encontrada del canvas original, ver nota de honestidad).
2. Desde ahí, CTA **"Iniciar Seguimiento de Sueño →"** — destino no confirmado por un nodo directo, pero por contenido y contexto es casi con certeza `preparar-descanso` (`160:2968`), ya que esa pantalla es exactamente el paso previo lógico ("Preparar Descanso — Configura tu entorno ideal") antes de rastrear.
3. **`preparar-descanso`**: configura Alarma Inteligente (hora + ventana de 30 min + toggle), completa una "Lista de Preparación" (checklist de 3 ítems: temperatura, bloqueo de luz azul, meditación — 1/3 ya marcado como ejemplo), revisa "Entorno" (tarjeta de Sonido con "Ruido Marrón" activo y fade de 45 min, tarjeta de "GYMIA Ring" conectado al 84% de batería). CTA principal **"¡Comenzar Seguimiento! →"**, secundario "Revisar permisos" (destino no confirmado).
4. **`seguimiento-activo`** (`160:3055`): pantalla de tracking en vivo, mostrando fase actual ("FASE INICIAL · SUEÑO LIGERO"), un visual de órbita central con frecuencia cardíaca en vivo (58 LPM), 3 filas de sensor en tiempo real (Frec. Cardíaca, Movimiento, Ambiente — con nivel de decibeles, implicando micrófono activo), condiciones de entorno rápidas (temperatura, humedad, batería del dispositivo). Controles: "Pausar" / **"Finalizar Sesión"** — el fin de sesión presumiblemente regresa a `sueño-conectado-inicio` con el nuevo "Análisis de Anoche" actualizado (no confirmado por un nodo de destino explícito, es la convención estándar).
5. Desde `sueño-conectado-inicio`, CTA secundaria **"Conectar otro dispositivo Wearable"** → `apps-y-relojes` (`171:2961`, "Apps y Relojes — Sincroniza tus fuentes de datos de salud"): lista "Sistemas Base" (Apple Health, Google Health Connect) y "Dispositivos y Anillos" (Oura Ring, WHOOP, Garmin Connect, Fitbit, Samsung Health, Polar, Xiaomi Fit, Withings), cada una con estado (`CONECTADO` / `DISPONIBLE` / `REQUIERE PERMISO`).
6. Tocar una integración no conectada (ej. Oura Ring) → `conectar-dispositivo` (`171:3104`), específicamente titulada **"Conectar Oura"** ("Paso 2 de 3 • Permisos de Telemetría"): 4 toggles de permisos granulares (Análisis del Sueño, Frecuencia Cardíaca, Frecuencia Respiratoria, Variabilidad Cardíaca/HRV), selector de periodo de importación inicial (Últimos 7 días / Todo el historial), aviso de privacidad que menciona **explícitamente el Escuadrón** (ver §9), y CTA **"Confirmar y Autorizar"**.
7. Desde `apps-y-relojes` (implícito, sin botón confirmado) o desde un ícono de diagnóstico → `diagnostico-fuentes` (`171:3198`, "Fuentes y Diagnóstico — Estado en tiempo real y resolución de conflictos"): lista de prioridad de fuentes (#1 Oura Ring, #2 Apple Watch marcado como "DUPLICADO", #3 Apple Health), detalle del último lote de telemetría recibido (intervalo sincronizado, 480 muestras cardíacas, "1 conflicto corregido automáticamente"), acciones "Forzar Reintento" / "Desvincular Oura", y una sección de troubleshooting que **también menciona explícitamente al Escuadrón** ("¿Faltan datos en el Escuadrón?").

Puntos de entrada **externos** a Sueño no auditados en esta pasada: no se buscaron menciones de Sueño en otras pantallas ya auditadas (Entrenar, Evolución, Perfil) más allá de lo ya documentado en `FIGMA_TO_APP_MASTER_PLAN.md` (`evolucion-error-adherencia` ya menciona depender de "datos de Sueño/Nutrición").

## 3. Pantallas

| Nodo Figma | Nombre | Descripción |
|---|---|---|
| 160:2968 | Preparar Descanso | Alarma inteligente (hora + ventana + toggle), checklist de preparación (temperatura/luz azul/meditación), tarjetas de entorno (sonido, dispositivo "GYMIA Ring" con batería), CTA "¡Comenzar Seguimiento!" |
| 160:3055 | Seguimiento Activo | Tracking en vivo: fase de sueño, frecuencia cardíaca (visual de órbita), movimiento, ruido ambiente (micrófono), temperatura/humedad/batería, controles Pausar/Finalizar |
| 171:2860 | Sueño Conectado (inicio) | Badge "SOMNIA AI", estado de sincronización con dispositivo, "Análisis de Anoche" (tiempo en cama, eficiencia, calidad de datos, recuperación), 4 enlaces "Ecosistema Somnia" (Historial/Reporte/Ajustes/Perfil — destinos no confirmados), CTAs Iniciar Seguimiento / Conectar otro dispositivo |
| 171:2961 | Apps y Relojes | Hub de integraciones: "Sistemas Base" (Apple Health, Google Health Connect) + "Dispositivos y Anillos" (Oura Ring, WHOOP, Garmin Connect, Fitbit, Samsung Health, Polar, Xiaomi Fit, Withings), cada una con estado de conexión |
| 171:3104 | Conectar Oura | Flujo de permisos específico de Oura Ring API v2 — 4 toggles de biometría, selector de periodo de importación, aviso de privacidad (menciona Escuadrón), "Confirmar y Autorizar" |
| 171:3198 | Fuentes y Diagnóstico | Prioridad de fuentes conectadas (con detección de duplicados), detalle del último lote de telemetría, acciones de reintento/desvinculación, troubleshooting (menciona Escuadrón) |

**No confirmadas / no localizadas:** Historial de Sueño, Reporte de Sueño, Ajustes de Sueño (referenciadas por nombre en los enlaces de "Ecosistema Somnia" de `171:2860`, sin nodo de pantalla propio encontrado), y una posible 3ª/4ª pantalla del canvas original `160:` en las posiciones de cuadrícula x=48/x=1314 (ver nota de honestidad en la introducción).

## 4. Integración con Apple Health

Confirmado explícitamente en Figma (`apps-y-relojes`, tarjeta "Sistemas Base"): **"Apple Health — Integración nativa iOS"**, estado `CONECTADO` en el mock. También aparece nombrada en `sueño-conectado-inicio` como fuente de sincronización ("Apple Watch • Hace 4m") y en `diagnostico-fuentes` como fuente #3 de prioridad ("Apple Health — Último respaldo ayer").

**Realidad técnica que Figma no puede mostrar y hay que documentar aquí (no está en las pantallas, es una restricción de plataforma real):**
- Apple HealthKit **no es una API OAuth/cloud** — es un framework nativo on-device. Se lee vía un módulo nativo (ej. `react-native-health` o equivalente Expo config plugin) que requiere: (a) un **Apple Developer entitlement de HealthKit** en el App ID, (b) un **build nativo** (EAS Build / development build) — **no funciona en Expo Go**, (c) solo funciona en **dispositivo físico iOS**, nunca en simulador para datos reales de sensores, (d) el usuario autoriza cada tipo de dato (sueño, FC, HRV) mediante el diálogo de permisos nativo de iOS, no una pantalla propia de GymIA — la pantalla `conectar-dispositivo` con sus 4 toggles corresponde al patrón de Oura (OAuth), no necesariamente al de HealthKit, cuyo diálogo de permisos lo controla iOS, no la app.
- No existe hoy ningún código, dependencia (`package.json` de `mobile` no tiene `react-native-health` ni equivalente) ni configuración de entitlement en el proyecto — esto es una integración nueva desde cero.

## 5. Integración con Health Connect

Confirmado explícitamente en Figma (`apps-y-relojes`): **"Google Health Connect — Sincronizador Android"**, estado `DISPONIBLE` (no conectado en el mock, a diferencia de Apple Health que sí aparece `CONECTADO`) — es la única evidencia en el archivo de que el diseñador trató Apple Health y Health Connect como **dos entradas separadas**, no una integración genérica única. No se encontró ninguna pantalla de permisos específica para Health Connect (a diferencia de Oura, que sí tiene su propia pantalla `conectar-dispositivo` con 4 toggles) — se infiere que reutilizaría el mismo patrón de permisos, pero no está confirmado por Figma.

**Realidad técnica (no está en las pantallas, es una restricción de plataforma real):**
- Health Connect **no es una API cloud** — es una app/almacén de datos on-device en Android (parte del sistema operativo desde Android 14, instalable como app aparte en versiones anteriores). Requiere que el usuario tenga la app Health Connect instalada, y se accede vía un módulo nativo (ej. `react-native-health-connect`) con su propio modelo de permisos por tipo de dato (`SleepSessionRecord`, `HeartRateRecord`, etc.), gestionado por la UI nativa de Android, no por una pantalla propia de GymIA.
- Tampoco funciona en Expo Go — requiere build nativo.
- Ninguna dependencia relacionada existe hoy en `mobile/package.json`.

## 6. Modelo Prisma

Ningún modelo de sueño existe hoy. Siguiendo la convención ya usada por `OnboardingProfile`/`BodyMetric` (migración aditiva, FK directa a `userId`, índices por usuario+fecha):

```prisma
model SleepSession {
  id                  String    @id @default(uuid())
  userId              String
  startedAt           DateTime
  endedAt             DateTime?
  timeInBedMinutes    Int?
  sleepEfficiencyPct  Float?    // "Eficiencia Somática" en Figma
  recoveryScorePct    Float?    // "Recuperación" en Figma
  avgHeartRateBpm     Float?
  minHeartRateBpm     Float?
  hrvMs               Float?    // Variabilidad Cardíaca
  respiratoryRateBpm  Float?
  dataQuality         String?   // ej. "alta" / "media" / "baja" — reflejar "Calidad de datos: Alta (4 biometrías)" de Figma
  source              String    // "apple_health" | "health_connect" | "oura" | "whoop" | "garmin" | "fitbit" | "samsung_health" | "polar" | "xiaomi" | "withings" | "manual"
  createdAt           DateTime  @default(now())

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  stages SleepStageEvent[]

  @@index([userId])
  @@index([userId, startedAt])
}

// Fases de sueño (REM/Ligero/Profundo/Despierto) con marca de tiempo — necesario
// para el "ciclo óptimo" de la alarma inteligente y el indicador de fase en vivo
// de seguimiento-activo ("FASE INICIAL · SUEÑO LIGERO").
model SleepStageEvent {
  id        String   @id @default(uuid())
  sessionId String
  stage     String   // "ligero" | "profundo" | "rem" | "despierto"
  startedAt DateTime
  endedAt   DateTime?

  session SleepSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

// Una fuente conectada por usuario — refleja la pantalla "Apps y Relojes" y
// permite el estado CONECTADO/DISPONIBLE/REQUIERE_PERMISO por integración.
model SleepDataSource {
  id            String    @id @default(uuid())
  userId        String
  provider      String    // mismo enum que SleepSession.source
  status        String    // "conectado" | "disponible" | "requiere_permiso" | "desvinculado"
  priority      Int       // orden de prioridad para resolución de duplicados (diagnostico-fuentes)
  lastSyncedAt  DateTime?
  // Permisos granulares vistos en conectar-dispositivo (Oura): se guardan como
  // booleanos explícitos en vez de un blob JSON para que cada uno pueda
  // auditarse y revocarse individualmente.
  grantsSleepAnalysis  Boolean @default(false)
  grantsHeartRate      Boolean @default(false)
  grantsRespiratoryRate Boolean @default(false)
  grantsHrv            Boolean @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
}

// Checklist de preparación (temperatura/luz azul/meditación) — configuración
// del usuario, no un catálogo global, porque en Figma el estado marcado
// (1/3 completado) es evidentemente por-sesión/por-usuario, no fijo.
model SleepPrepChecklistItem {
  id          String   @id @default(uuid())
  userId      String
  label       String
  isCompleted Boolean  @default(false)
  order       Int

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Honestidad sobre lo que NO se modela aquí:** "Alarma Inteligente" con ventana de 30 min y despertar en "ciclo óptimo" implica un algoritmo de predicción de fase de sueño en tiempo real para decidir CUÁNDO despertar dentro de la ventana — eso no es solo almacenamiento de datos, es lógica de producto no trivial (¿qué fase es "óptima" para despertar? ¿con qué certeza se predice sin datos aún completos de esa noche?) que no se resuelve con un modelo de datos, se documenta como parte del riesgo en §9.

## 7. Endpoints

Siguiendo el patrón exacto de `BodyCompositionController`/`OnboardingController` (guard JWT, `@CurrentUser()`, DTOs con `class-validator`), un nuevo módulo `SleepModule`:

```
GET    /sleep/sessions                    — historial de sesiones del usuario (paginado)
GET    /sleep/sessions/latest             — última sesión ("Análisis de Anoche")
POST   /sleep/sessions                    — crear sesión manual o iniciar tracking (startedAt, source)
PATCH  /sleep/sessions/:id                — actualizar sesión en curso (finalizar, agregar métricas) o importada
DELETE /sleep/sessions/:id

GET    /sleep/sources                     — listado "Apps y Relojes" con status por proveedor
POST   /sleep/sources/:provider/connect   — iniciar flujo OAuth (Oura) o registrar conexión nativa (HealthKit/Health Connect ya autorizada en el dispositivo)
PATCH  /sleep/sources/:provider           — actualizar permisos granulares / prioridad
DELETE /sleep/sources/:provider           — desvincular ("Desvincular Oura")
POST   /sleep/sources/:provider/resync    — "Forzar Reintento"

GET    /sleep/prep-checklist              — checklist de preparación del usuario
PATCH  /sleep/prep-checklist/:id          — marcar completado

GET    /sleep/diagnostics                 — último lote de telemetría + conflictos detectados (diagnostico-fuentes)
```

**Nota:** los endpoints `/sleep/sources/:provider/connect` para Apple Health y Health Connect no pueden ser un simple OAuth callback como Oura — el flujo real es "el cliente móvil ya obtuvo permiso nativo, y le informa al backend que la fuente quedó habilitada, junto con qué permisos concedió" (el backend nunca hace un OAuth contra Apple/Google para esto). Esto debe reflejarse en el DTO (permisos ya otorgados en el payload, no un `code` de OAuth) — documentado aquí para que la implementación futura no asuma incorrectamente un patrón OAuth uniforme para las 10 fuentes.

## 8. Alcance MVP

Incluso el recorte mínimo requiere resolver primero cómo el teléfono obtiene datos reales de sueño — no hay forma de tener *ninguna* pantalla de Sueño con datos reales sin al menos una integración funcionando. Con esa base:

- **Una sola fuente**: Apple Health en iOS (más simple que Oura porque no requiere backend OAuth ni cuenta de terceros, solo el entitlement + build nativo) o Health Connect en Android — no ambas simultáneamente para el primer recorte.
- `SleepSession` + `SleepStageEvent` poblados por importación real desde esa única fuente (sin tracking en vivo con micrófono/sensores propios — ver más abajo).
- `sueño-conectado-inicio` simplificado: solo "Análisis de Anoche" con datos reales importados, sin el badge "SOMNIA AI" ni los 4 enlaces de Ecosistema Somnia (que no tienen pantalla de destino confirmada, ver §3).
- `apps-y-relojes` con una sola fila activa (la fuente elegida), el resto de proveedores (Oura, WHOOP, Garmin, etc.) mostrados como "Próximamente" en vez de "DISPONIBLE" — honestidad sobre lo que realmente funciona.
- **Explícitamente fuera del MVP**: `preparar-descanso` y `seguimiento-activo` completas (implican tracking en tiempo real con micrófono/sensores propios del teléfono o anillo — infraestructura de captura continua que no existe), integración con Oura/WHOOP/Garmin/Fitbit/Samsung/Polar/Xiaomi/Withings, `conectar-dispositivo` (flujo OAuth solo aplica si se agrega Oura, no para el MVP de un solo proveedor nativo), `diagnostico-fuentes` (no aplica con una sola fuente, no hay conflictos que resolver), Alarma Inteligente con predicción de fase óptima, checklist de preparación, "GYMIA Ring" (dispositivo propio, no existe como producto).

## 9. Riesgos y dependencias

1. **Tracking en tiempo real es la pieza más grande, no la conexión con una API.** `seguimiento-activo` implica captura continua de audio (micrófono, para "Ambiente 18 dB"), movimiento y frecuencia cardíaca durante 7-8 horas con la app corriendo (o un dispositivo externo). En iOS esto choca con las restricciones de tareas en segundo plano de Apple; construirlo bien (sin agotar la batería, sin que iOS mate el proceso) es un problema de ingeniería no trivial, muy distinto de simplemente "leer sueño de HealthKit después del hecho".
2. **Multi-proveedor real es una integración distinta por cada marca.** Oura tiene su propia API REST v2 con OAuth propio; WHOOP, Garmin, Fitbit, Samsung Health, Polar, Withings y Xiaomi cada una tiene su propio SDK/API con sus propios términos, límites de rate y proceso de aprobación de developer — no es "una integración de wearables", son hasta 8 integraciones independientes, cada una con su propio costo de mantenimiento.
3. **Apple Health y Health Connect no son APIs cloud — son SDKs nativos on-device.** Ya documentado en §4/§5: requieren build nativo (no Expo Go), entitlements/configuración de plataforma, y no tienen "pantalla de conexión" propia de GymIA — el permiso lo gestiona el sistema operativo. Cualquier plan que trate las 10 fuentes de "Apps y Relojes" como si todas usaran el mismo patrón de conexión (como el flujo OAuth de 3 pasos de Oura) está equivocado desde el diseño.
4. **"GYMIA Ring" no es un producto que exista.** Aparece en `preparar-descanso`/`seguimiento-activo` como un anillo conectado por Bluetooth con batería propia — si es un hardware propio planeado, es una decisión de negocio (fabricación, cadena de suministro) completamente fuera del alcance de este equipo de software; si es un placeholder de diseño, debería aclararse antes de construir nada que dependa de él.
5. **Alarma Inteligente con "ciclo óptimo" es un algoritmo de predicción, no solo UI.** Decidir el momento de despertar dentro de una ventana de 30 min según la fase de sueño detectada en tiempo real es lógica de producto no trivial (falsos positivos de fase = despertar en el momento equivocado, el efecto contrario al buscado).
6. **Dependencia confirmada con Evolución** (ya documentada en `FIGMA_TO_APP_MASTER_PLAN.md` §4, fila `evolucion-error-adherencia`): ese gap depende explícitamente de "datos de Sueño/Nutrición" en el calendario semanal de adherencia. Sueño es un prerrequisito real para resolver ese gap, no al revés.
7. **Dependencia confirmada con Escuadrón, dos veces, con las propias palabras de Figma:** el aviso de privacidad en `conectar-dispositivo` dice literalmente *"Tus datos biométricos se procesan localmente para calibrar tu prescripción de entrenamiento en el Escuadrón"*, y `diagnostico-fuentes` tiene una sección de troubleshooting titulada *"¿Faltan datos en el Escuadrón?"*. Esto confirma, desde el lado de Sueño, lo que `ESCUADRON_PRODUCT_SPEC.md` §11 ya inferían desde el lado de Escuadrón: ambos módulos comparten datos de sueño entre usuarios de un mismo escuadrón — lo cual hereda el riesgo #1 de ese documento (ruptura controlada del aislamiento estricto por `userId` que rige todo el backend actual).
8. **El tab bar de 5 posiciones ya está sobre-comprometido — riesgo compartido con Escuadrón, evidencia nueva encontrada en esta pasada.** Se observaron **tres variantes distintas** del bottom-nav de 5 pestañas en las pantallas ya auditadas del archivo: (a) Evolución/Perfil → Evolución/Entrenar/Nutrición/**Escuadrón**/Perfil; (b) pantallas del canvas original de Sueño (`160:`) → Evolución/Entrenar/Nutrición/**Sueño**/**Escuadrón** (sin Perfil); (c) pantallas del canvas de extensión de Sueño (`171:`) → Evolución/Entrenar/Nutrición/**Sueño**/Perfil (sin Escuadrón). El diseñador nunca reconcilió un tab bar único con Sueño **y** Escuadrón **y** Perfil simultáneamente — matemáticamente no caben los 6 en 5 posiciones sin un patrón de overflow ("Más") que tampoco se encontró en el archivo. Cualquier plan de implementación de Sueño debe resolver esto junto con Escuadrón, no por separado — es la misma pregunta de navegación, no dos.
9. **Privacidad de datos biométricos.** Frecuencia cardíaca, HRV y datos de sueño son categorías de datos de salud sensibles bajo la mayoría de marcos regulatorios (HIPAA no aplica directamente a esta app, pero GDPR/leyes locales de datos de salud sí podrían); el aviso "🔒 Privacidad Protegida" de Figma es una sola línea de copy, no una política — se documenta como pendiente de definir antes de recolectar cualquier dato real.
10. **Pantallas no localizadas (Historial, Reporte, Ajustes de Sueño).** Como con la pantalla de creación de Escuadrón, implementar estos 3 enlaces sin encontrar su diseño real significaría inventar pantallas — no se debe hacer hasta localizarlas (si existen en la posición no encontrada del canvas original) o decidir su diseño explícitamente.
