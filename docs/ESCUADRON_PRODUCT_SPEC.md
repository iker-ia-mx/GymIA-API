# Escuadrón — Especificación de Producto (según Figma)

**Fecha:** 2026-09-24
**Fuente:** Figma `fileKey=O4cXfRJ7qCbKuH3Jdon00k`, página "Final-Pro". Este documento es **solo investigación y especificación** — no se implementó nada, no hay commits.

**Cómo se encontró este módulo:** "Escuadrón" era, hasta hoy, únicamente un nombre de pestaña visto en el bottom-nav de otras pantallas ya auditadas (evolución, perfil). No existía ni una sola línea sobre qué contenía. Este documento es el primer análisis exhaustivo de qué es realmente.

**Hallazgo metodológico importante que corrige el plan maestro:** las 8 pantallas de Escuadrón viven dentro de un frame contenedor llamado `GymIA-Ecosystem-Canvas` (nodo `138:5711`), y sus 8 frames hijos están **todos nombrados genéricamente "nutricion"** (`138:5712`, `138:5820`, `138:5924`, `138:6023`, `138:6250`, `138:6348`, `138:6436`, `138:6522`) — nombres de capa que el diseñador nunca actualizó. `docs/FIGMA_TO_APP_MASTER_PLAN.md` §1.6 las había catalogado como *"12 pantallas 'nutricion' sin nombre descriptivo, pendientes de identificar"*. Con este análisis, esas 8 quedan identificadas como Escuadrón, no como Nutrición. (Las 4 restantes del grupo "×12" — nodos `142:6300`, `142:6406`, `142:6513`, `142:6608` — también se identificaron de paso: son pantallas de **Perfil/Ajustes** — "Integraciones y Salud", "Membresía y Pagos", "Seguridad y Avisos", "Ayuda y Soporte" — no de Nutrición ni de Escuadrón. Se deja constancia aquí para que `FIGMA_TO_APP_MASTER_PLAN.md` se corrija en un turno posterior; no se modifica ese documento en este turno porque no fue lo que se pidió.)

No se encontró ningún diagrama `AI-FLOW::*` dedicado a Escuadrón (el diseñador sí diagramó los flujos de Auth, Onboarding, System states y Sueño con nodos `AI-FLOW::ARROW::*`/`LABEL::*`/`LANE::*`, pero no para este módulo). Las únicas conexiones de flujo relacionadas son genéricas de canvas: `AI-FLOW::ARROW::GymIA-Ecosystem-Canvas→GymIA-Ecosystem-Canvas`, `→gymia-nutrition-suite` y `→GymIA-Profile-Canvas` — es decir, el propio diseñador vinculó este canvas al de Nutrición y al de Perfil, pero no dejó un diagrama de flujo interno de Escuadrón. Todo lo que sigue en la §3 (flujo) es **inferido de las 8 pantallas mismas** (botones, back-buttons, CTAs), no de un diagrama del diseñador — se marca como tal donde la inferencia es débil.

Se revisaron también, sin encontrar más contenido de Escuadrón, las otras 5 secciones del archivo que no estaban catalogadas en el plan maestro (127, 163, 276, 290, 296, 300): todas son pantallas sueltas que reutilizan el mismo bottom-nav de 5 pestañas, y 163 es una extensión del canvas de Sueño (`GymIA-Sleep-Canvas-Extension`) — ninguna es un canvas dedicado a Escuadrón.

---

## 1. Objetivo del módulo

Según lo que muestran las 8 pantallas, Escuadrón es un **módulo social/comunitario y de gamificación en equipo**: agrupa a un subconjunto de usuarios de GymIA en un "escuadrón" (equipo) con nombre propio, avatar, rango y racha colectivos. Dentro de un escuadrón los miembros:
- ven un ranking de XP y rachas individuales entre sí,
- publican y ven un feed de logros de entrenamiento, comidas y progreso de sus compañeros,
- participan en retos colectivos (con progreso grupal e individual) y eventos presenciales/virtuales,
- desbloquean insignias/logros compartidos,
- gestionan membresía (invitar, aceptar solicitudes, buscar otros escuadrones públicos),
- y, si son líder/co-líder, administran el escuadrón (nombre, privacidad, permisos, moderación IA, disolución).

En una frase: es la capa social de accountability y competencia amistosa sobre los datos que el usuario ya genera en Entrenar/Nutrición/Evolución/Composición Corporal.

## 2. Problema que resuelve

Ninguna pantalla lo declara explícitamente (no hay copy tipo "por qué existe esto"), así que esto es una lectura razonada del diseño, no una cita literal de Figma:
- **Adherencia por presión social positiva**: la app ya calcula "rachas" y progreso individual (ver Evolución); Escuadrón lo convierte en algo visible por otros, con "Racha de X días perdida" mostrado a nivel de equipo y "Meta Semanal Colectiva" — el mecanismo clásico de gamificación social para sostener el hábito de entrenar.
- **Soledad del usuario solitario**: sin este módulo, GymIA es una app 100% individual (cada tabla en el esquema está aislada por `userId`, sin excepción). Escuadrón es el único punto de contacto entre usuarios que existe en todo el diseño de Figma.
- **Monetización**: el plan "GymIA Squad Elite" ($14.99/mes, visto en la pantalla de Membresía y Pagos de Perfil) ofrece "Acceso a Retos de Escuadrón con doble XP" como beneficio — Escuadrón es, en parte, una palanca de conversión a premium.

## 3. Flujo completo de usuario

**Advertencia explícita:** no existe un diagrama de flujo del diseñador para este módulo (ver arriba). Lo siguiente se reconstruyó pantalla por pantalla, siguiendo botones y back-buttons — es la mejor reconstrucción posible, no una fuente confirmada.

**Gap de entrada al flujo — el más importante de señalar:** ninguna de las 8 pantallas es un estado "no tienes escuadrón todavía" ni "crear tu primer escuadrón". Las 8 pantallas asumen que el usuario **ya pertenece** a "Alpha Squad". No se encontró:
- una pantalla de creación de escuadrón (nombre, avatar, privacidad inicial),
- un estado vacío para el usuario sin escuadrón,
- ni un paso de onboarding que mencione Escuadrón (los 5 pasos de onboarding auditados en `FIGMA_TO_APP_MASTER_PLAN.md` §1.1 no lo tocan).

Esto dejó un vacío real en el diseño: cómo llega un usuario nuevo a tener un escuadrón es desconocido. Lo más cercano es la pantalla "Invitar y Unirse", pero está enmarcada como *expandir* un escuadrón existente ("Expande la comunidad Alpha"), no como crear uno desde cero.

Con esa salvedad, el flujo reconstruido para un usuario que **ya está en un escuadrón**:

1. **Tab "Escuadrón"** (5º ítem del bottom-nav, entre Nutrición y Perfil) → abre el **Hub** (`138:5712`, "Escuadrón Alpha"): identidad del equipo, racha, meta semanal colectiva, 3 atajos (Miembros/Feed/Retos), ranking top-3, actividad reciente.
2. Desde el Hub, atajo **Miembros** → `138:5820`: buscar miembro, invitar (CTA que probablemente navega a Invitar y Unirse, aunque el destino exacto del botón no está confirmado por Figma — solo se infiere por el texto), gestionar solicitudes pendientes (Aceptar/Rechazar), lista completa con roles.
3. Desde Miembros, tocar un miembro → `138:6250` **Perfil de Miembro**: stats agregadas (XP, adherencia %, entrenamientos, sugerencias IA aceptadas), PRs, botones "Comparar mis estadísticas" y "Enviar reconocimiento" (ninguno de los dos tiene una pantalla de destino identificada en Figma — son acciones sin pantalla de resultado visible en el archivo).
4. Desde el Hub, atajo **Feed** → `138:5924`: filtros por tipo (Todo/Fuerza/Comidas/Récords), barra de composición rápida, lista de posts con like/comentario.
5. Desde el Feed, la barra de composición o el botón "NUEVO" → `138:6348` **Crear Publicación**: elegir tipo (Entrenamiento/Comida/Progreso), texto + hashtags, adjuntar multimedia, visibilidad, publicar → vuelve presumiblemente al Feed (no confirmado explícitamente, es la convención estándar de este tipo de flujo).
6. Desde el Hub, atajo **Retos** → `138:6023` **Retos y Eventos**: reto activo con progreso grupal + tu aporte individual, próximo evento con RSVP, recompensas/logros.
7. Desde Miembros (o el Hub — destino exacto no confirmado), **Invitar y Unirse** → `138:6436`: código/QR de acceso único para invitar, contactos sugeridos (con estado "En tus contactos" o "Racha de 8d en otra liga" — implica que la app ya sabe si ese contacto usa GymIA y en qué otro escuadrón está), buscador de escuadrones públicos para unirse a uno distinto.
8. Solo para Líder/Co-Líder — de dónde exactamente se llega no está confirmado por Figma (ningún botón visible en el Hub apunta aquí; se infiere que sería un ícono de ajustes no capturado o parte de la navegación de Miembros) → **Administrar Escuadrón** (`138:6522`): nombre, privacidad (toggle), permisos ("Permitir posts a miembros", "Moderación IA automática"), zona de peligro (Abandonar / Disolver).

Puntos de entrada **externos** a Escuadrón detectados en otras pantallas ya auditadas:
- Al finalizar una sesión de entrenamiento existe una sección "Compartir entrenamiento" con 3 destinos: Perfil, **Escuadrón**, Instagram (`292:1699`) — comparte un logro de Entrenar directamente al feed del escuadrón.
- La pantalla de Perfil "Membresía y Pagos" muestra el plan "GymIA Squad Elite" con el beneficio "Acceso a Retos de Escuadrón con doble XP" — vínculo con Pagos (ver §4 del plan maestro, ya documentado como gap).

## 4. Todas las pantallas

| Nodo Figma | Nombre (real, no el de capa) | Descripción |
|---|---|---|
| 138:5712 | Escuadrón Alpha (Hub) | Identidad de equipo (nombre, rango, racha), meta semanal colectiva con barra de progreso, 3 atajos (Miembros/Feed/Retos), ranking top-3 con XP y racha, actividad reciente (feed teaser) |
| 138:5820 | Miembros | Búsqueda por nombre, CTA "Invitar nuevo miembro", solicitudes pendientes (Aceptar/Rechazar), lista completa con rol (Líder/Co-Líder/Miembro), racha, XP, indicador online |
| 138:5924 | Feed del Escuadrón | Filtros (Todo/Fuerza/Comidas/Récords), barra "Compartir logro o receta con el grupo...", posts con autor/hora/tipo/texto/imagen/likes/comentarios |
| 138:6023 | Retos y Eventos | Reto activo (progreso grupal + individual, cada uno con su propia barra), próximo evento grupal (fecha, lugar, descripción, RSVP), recompensas/logros (insignias) |
| 138:6250 | Perfil de Miembro | Avatar, rol, rango, racha, grid de stats (XP total, Adherencia Promedio, Entrenamientos, Sugerencias IA aceptadas), PRs (Récords Personales), botones Comparar/Reconocimiento |
| 138:6348 | Crear Publicación | Selector de tipo (Entrenamiento/Comida/Progreso), caja de texto con hashtags, adjuntar multimedia, visibilidad del post, botón Publicar |
| 138:6436 | Invitar y Unirse | Código de acceso único + QR, contactos sugeridos con estado ("En tus contactos" / "Racha de Xd en otra liga"), buscador de escuadrones públicos |
| 138:6522 | Administrar Escuadrón | Nombre del equipo (editable), toggle de privacidad, toggle "Permitir posts a miembros", toggle "Moderación IA automática", Abandonar Escuadrón, Disolver Escuadrón |

No se encontraron pantallas adicionales de: creación de escuadrón, estado vacío "sin escuadrón", detalle de comentarios (el feed solo muestra un contador "N comentarios", sin pantalla de hilo), resultado de "Comparar estadísticas" ni de "Enviar reconocimiento", ni una pantalla de resultado de búsqueda de escuadrones públicos (el buscador de `138:6492` no tiene un estado de resultados visible en el archivo).

## 5. Navegación

- **Posición en el tab bar:** 5ª pestaña, entre Nutrición y Perfil (orden visto consistentemente en las 8 pantallas y en las de Evolución/Perfil ya auditadas hoy: Evolución, Entrenar, Nutrición, **Escuadrón**, Perfil).
- **Patrón de stack:** las 8 pantallas comparten el mismo `back-btn` (componente reutilizado, instancia `212:1523`/`113:4446`) y un header con back-chevron — mismo patrón que ya usa la app en `entrenar/_layout.tsx` y `perfil/_layout.tsx` (un `<Stack>` de expo-router anidado dentro del tab). El Hub (`138:5712`) es la única pantalla sin back-button — es la raíz del stack, igual que `entrenar/index.tsx` o `perfil/index.tsx`.
- **Navegación confirmada por botones explícitos:** Hub → Miembros (atajo), Hub → Feed (atajo), Hub → Retos (atajo), Feed → Crear Publicación (CTA "NUEVO").
- **Navegación inferida, no confirmada por un botón con destino explícito en el nodo inspeccionado:** Miembros → Perfil de Miembro (se infiere porque cada fila de miembro es claramente tocable, pero el nodo de la fila no llevaba una anotación de destino), Miembros/Hub → Invitar y Unirse (el CTA "Invitar nuevo miembro" en Miembros y el ícono "user-plus" sugieren esto, pero no hay flecha de flujo del diseñador que lo confirme), algo → Administrar Escuadrón (no se encontró NINGÚN botón en las otras 7 pantallas que apunte aquí — llegar a esta pantalla es la navegación menos confirmada de las ocho).

## 6. Datos requeridos

Ninguno de estos existe hoy en el backend (ver §7). Lista de qué necesita persistirse, derivada estrictamente de lo que las pantallas muestran:

- **Squad**: nombre, avatar, tagline ("El Olimpo del rendimiento"), rango/tier (p. ej. "Diamante IV" — implica un sistema de tiers, no solo un número), racha colectiva (días), meta semanal colectiva (valor objetivo + valor actual, en kcal según la pantalla vista — podría generalizarse), privacidad (público/privado), código de invitación único, fecha de creación.
- **SquadMembership**: usuario, escuadrón, rol (Líder/Co-Líder/Miembro — jerarquía de 3 niveles), fecha de ingreso, XP acumulado *dentro del escuadrón*, racha individual, estado en línea/desconectado.
- **SquadJoinRequest**: usuario solicitante, escuadrón, estado (pendiente/aceptada/rechazada).
- **SquadInvite**: quién invita, a quién (contacto o por código), estado.
- **SquadPost**: autor, tipo (Entrenamiento/Comida/Progreso), texto, hashtags, adjuntos multimedia, visibilidad, timestamp, contador de likes, contador de comentarios (sin modelo de comentario individual confirmado — solo se ve el contador).
- **SquadPostLike**: quién dio like a qué post.
- **SquadChallenge**: título, tipo (p. ej. "Desafío de Cardio Semanal"), objetivo grupal (valor + unidad, ej. "500 km"), progreso grupal, objetivo individual por miembro, progreso individual, fecha de fin, estado (activo/finalizado).
- **SquadEvent**: título, fecha, hora, ubicación (física o "virtual"), descripción, lista de asistentes confirmados (RSVP).
- **SquadAchievement/Badge**: catálogo de insignias (ej. "Guerrero de Acero"), progreso de desbloqueo por miembro o por escuadrón.
- **Stats derivadas por miembro** (mostradas en Perfil de Miembro, calculadas — no almacenadas directamente): XP total, "Adherencia Promedio" (%), entrenamientos completados (ej. "24/30 días"), sugerencias de IA aceptadas, PRs (récords personales por ejercicio).

Puntos críticos de honestidad:
- **XP y "rango"/tier no existen en absoluto** en ningún lugar de la app hoy — no hay fórmula, no hay tabla, no hay concepto. Es un sistema de gamificación completo por diseñar desde cero.
- **"Adherencia Promedio"** es el mismo concepto ya marcado como gap en `FIGMA_TO_APP_MASTER_PLAN.md` (nodo `evolucion-error-adherencia`, sin fórmula definida) — aquí aparece otra vez, pero ahora expuesto **de un usuario a otro**, lo cual añade una capa de decisión de privacidad además de la de cálculo.
- **"Sugerencias IA aceptadas"** no es un evento que la app registre hoy en ningún flujo (ni onboarding ni nutrición tienen un concepto de "sugerencia de IA que el usuario acepta o rechaza" instrumentado).
- **PRs** sí tienen un equivalente real: `EvolutionService.getStrengthOverview`/`getExerciseHistory` ya calculan el mejor 1RM estimado por ejercicio — este es el único dato de la lista que se puede alimentar con un cálculo que ya existe, aunque solo para el propio usuario (ver §11).

## 7. Cambios de backend necesarios

El esquema actual (`prisma/schema.prisma`) no tiene **ningún** concepto de relación entre usuarios — cada modelo (`Routine`, `WorkoutSession`, `BodyMetric`, `Meal`, `NutritionGoal`, `OnboardingProfile`, etc.) tiene una FK directa a `userId` y cada query en cada servicio (`workouts.service.ts`, `evolution.service.ts`, `body-composition`) filtra estrictamente por el usuario autenticado. Construir Escuadrón requiere:

1. **Modelos Prisma nuevos** (siguiendo el patrón ya usado por `OnboardingProfile`, migraciones aditivas, sin tocar tablas existentes):
   - `Squad` (name, avatarUrl, tagline, tier, streakDays, weeklyGoalTarget, weeklyGoalCurrent, isPrivate, inviteCode, createdAt).
   - `SquadMembership` (squadId, userId, role enum [LIDER, CO_LIDER, MIEMBRO], xp, streakDays, joinedAt) — `@@unique([squadId, userId])`.
   - `SquadJoinRequest` (squadId, userId, status, createdAt).
   - `SquadPost` (squadId, authorId, type enum [ENTRENAMIENTO, COMIDA, PROGRESO], text, hashtags, mediaUrl, visibility, createdAt).
   - `SquadPostLike` (postId, userId) — `@@unique([postId, userId])`.
   - `SquadChallenge` (squadId, title, groupTargetValue, groupTargetUnit, startsAt, endsAt), `SquadChallengeProgress` (challengeId, userId, individualProgress).
   - `SquadEvent` (squadId, title, startsAt, location, description), `SquadEventRSVP` (eventId, userId).
   - `SquadAchievement` (catálogo global) + `SquadMemberAchievement` (desbloqueo por miembro).
2. **Nuevo módulo NestJS `SquadModule`** (`squad.module.ts`, `squad.service.ts`, `squad.controller.ts`, DTOs con `class-validator`) — mismo patrón que `OnboardingModule`. Endpoints mínimos: crear/buscar/unirse a escuadrón, gestionar membresía y roles, CRUD de posts+likes, CRUD de retos/eventos+RSVP, endpoints de administración con guard de rol (solo Líder/Co-Líder).
3. **Motor de XP y rachas** — no existe ni siquiera a nivel individual hoy. Requiere: definir qué acciones otorgan XP (¿completar sesión? ¿registrar comida?), una fórmula, y un job/trigger que lo calcule. Es infraestructura nueva compartida entre Escuadrón y, potencialmente, Evolución (donde "adherencia/rachas" ya se había flagueado como gap).
4. **Autorización cross-user controlada** — el mayor cambio arquitectónico: hoy el guard JWT + cada query garantiza aislamiento total por `userId`; Escuadrón necesita, de forma deliberada y acotada, exponer datos de otros usuarios (nombre, XP, racha, PRs, adherencia) **solo** a quienes comparten escuadrón. Esto no es "agregar un modelo", es una excepción explícita al principio de aislamiento que rige todo el backend actual — debe diseñarse con cuidado (¿qué pasa si un usuario sale del escuadrón? ¿ve el ex-compañero sus posts viejos?).
5. **Invitación por contactos** — "Contactos Sugeridos" implica hacer *matching* entre la agenda de contactos del dispositivo (teléfono/email) y usuarios registrados en GymIA. Esto requiere subir contactos (hasheados, idealmente) al backend y cruzarlos contra `User.email` — una superficie de privacidad nueva y sensible que no existe en ningún otro flujo de la app.
6. **Moderación IA automática** — toggle visto en Administrar Escuadrón ("Filtra recetas y posts irrelevantes"). Requiere un servicio de moderación de contenido (texto/imagen) — no existe ningún servicio de IA real integrado en el backend hoy (el resto de "IA" en la app son fórmulas determinísticas, documentado así explícitamente en otros módulos).
7. **Almacenamiento de media de posts** — mismo mecanismo que `ProgressPhoto`/Supabase Storage ya usado para fotos de progreso, reutilizable, pero necesita su propio bucket/política de acceso (contenido visible por *otros* usuarios del escuadrón, distinto de `ProgressPhoto` que es privado).
8. **Dependencia de Pagos** — el beneficio "doble XP" del plan "GymIA Squad Elite" no puede implementarse hasta que exista el sistema de suscripciones (`premium-caducado`/`pago-fallido`, ya documentado como gap sin resolver en `FIGMA_TO_APP_MASTER_PLAN.md` §4).

## 8. Cambios de mobile necesarios

Siguiendo el patrón ya establecido por `entrenar/_layout.tsx` y `perfil/_layout.tsx` (un `<Stack>` de expo-router anidado dentro del tab):

1. **Nuevo grupo de rutas** `src/app/(app)/escuadron/`: `_layout.tsx` (Stack), `index.tsx` (Hub), `miembros.tsx`, `miembro/[id].tsx` (Perfil de Miembro), `feed.tsx`, `feed/crear.tsx` (o `crear-publicacion.tsx`), `retos.tsx`, `invitar.tsx`, `administrar.tsx`.
2. **Nueva pestaña en `(app)/_layout.tsx`**: agregar `<Tabs.Screen name="escuadron" ... />` entre `nutricion` y `perfil`, con un nuevo ícono (`TabIcon` ya soporta variantes por nombre — se ve un ícono "users" reutilizado en Figma, coherente con el que ya usa el proyecto en otros lados).
3. **Nuevo cliente API** `src/lib/squadApi.ts`, mismo patrón que `workoutApi.ts`/`evolutionApi.ts`/`onboardingApi.ts` (tipos + funciones `apiRequest`).
4. **Nueva dependencia**: `expo-contacts` (o equivalente) para la función de "Contactos Sugeridos" — no está instalada hoy (`package.json` no la tiene).
5. **Reutilización de patrones existentes**: el picker de imágenes para "Crear Publicación" puede reutilizar la lógica ya construida en `cuerpo-agregar-foto.tsx` (permisos de cámara/galería, subida a Storage); el componente `Card` y los tokens de `theme/tokens.ts` se reutilizan igual que en el resto de la app.
6. **Componente compartido nuevo**: una fila de "miembro" (avatar + nombre + rol + racha/XP) se repite en Hub (ranking), Miembros (lista) y Retos — candidato claro a un componente propio en `src/components/`, igual que `SystemStateScreen` se extrajo para los 11 estados de sistema.

## 9. Dependencias con Entrenar

- **Compartir entrenamiento → Feed de Escuadrón**: la pantalla de resumen de sesión ya tiene, en Figma, un destino "Escuadrón" junto a "Perfil" e "Instagram" (`292:1699`, sección `share-workout-section`) — esto no fue auditado como pantalla propia de Entrenar en el plan maestro, es un hallazgo de este análisis. Compartir un entrenamiento terminado debería crear un `SquadPost` tipo `ENTRENAMIENTO`.
- **PRs en Perfil de Miembro**: "Peso Muerto 180 kg × 3 reps" es exactamente el mismo dato que ya calcula `EvolutionService.getStrengthOverview` (1RM estimado con la fórmula de Epley) — la fuente de verdad para PRs ya existe, solo falta poder consultarla para *otro* usuario dentro del mismo escuadrón (rompe el aislamiento actual, ver §7.4).
- **Retos con componente de entrenamiento**: "Desafío de Cardio Semanal" mide minutos/km — no hay un campo de duración o distancia en `WorkoutSession`/`SetLog` hoy (el modelo registra series de peso×reps, no minutos ni distancia cardio). Retos de este tipo necesitarían un nuevo tipo de registro que Entrenar no soporta actualmente.

## 10. Dependencias con Nutrición

- **Tipo de post "Comida"**: el feed muestra un post de comida ("Cena de recuperación sugerida por GymIA... 850 KCAL") — se apoyaría en los datos ya reales de `Meal`/`MealItem`/`Food`.
- **"Sugerencias IA aceptadas" (stat de Perfil de Miembro)**: no hay ningún evento instrumentado hoy que registre cuándo un usuario acepta una sugerencia de Nutria IA — Nutrición tampoco tiene ese concepto construido (las sugerencias de IA de nutrición, si existen en Figma, no fueron parte de este análisis; el propio módulo de Nutrición todavía tiene gaps grandes documentados en `FIGMA_TO_APP_MASTER_PLAN.md` §1.6).
- **Compartir receta**: el placeholder del compositor de Feed dice "Compartir logro **o receta** con el grupo..." — implica una integración con el módulo de recetas de Nutrición, que en sí mismo todavía no está construido (`S2-MyRecipes` etc., ya documentado como pendiente en Fase 2 del plan maestro).

## 11. Dependencias con Evolución

- **"Adherencia Promedio 94%"** (Perfil de Miembro) es el mismo gap ya documentado hoy en `FIGMA_TO_APP_MASTER_PLAN.md` (`evolucion-error-adherencia`, sin fórmula ni backend). Escuadrón no solo depende de que ese gap se resuelva — lo hace más grande, porque aquí "adherencia" necesita ser visible **entre usuarios**, no solo para uno mismo.
- **Racha de días** — `evolucion-error-adherencia` ya mostraba "Racha de 12 días perdida" a nivel individual; Escuadrón añade una racha **colectiva** del equipo completo, un segundo concepto de racha que tampoco existe.
- **Ranking por XP**: no tiene equivalente hoy en Evolución (que sí tiene un `progressScore` calculado con fórmula transparente, pero es una puntuación 0-100 individual, no XP acumulativo ni comparable entre usuarios).

## 12. Dependencias con Composición Corporal

- **Tipo de post "Progreso"** en Crear Publicación probablemente corresponde a compartir una foto de progreso o una medición corporal — el mecanismo de captura ya existe (`cuerpo-agregar-foto.tsx`, `ProgressPhoto`), pero esas fotos son hoy estrictamente privadas (`ProgressPhoto` no tiene ningún campo de visibilidad). Compartirlas en un feed de escuadrón requiere decidir explícitamente cambiar esa política de privacidad para el caso compartido, sin afectar las fotos que el usuario nunca comparte.
- No se encontró ninguna otra referencia directa a `BodyMetric` en las 8 pantallas de Escuadrón (el "Progreso" del post es la única conexión, y es una inferencia razonable, no un campo explícito visto en Figma).

## 13. Alcance MVP

Incluso el recorte más pequeño requiere resolver primero el problema arquitectónico de fondo (§7.4: excepción controlada al aislamiento por usuario) — no hay forma de tener *ningún* Escuadrón funcional sin eso. Con esa base:

- `Squad` + `SquadMembership` (roles Líder/Miembro, sin Co-Líder todavía) — crear/unirse por código.
- Hub simplificado: nombre del equipo, lista de miembros con XP básico (definir una fórmula simple, ej. sesiones completadas × constante — documentado como fórmula transparente, no "IA real", mismo principio ya usado en `progressScore`).
- Miembros: lista + búsqueda, sin solicitudes pendientes (unirse por código es instantáneo, sin aprobación).
- Feed: solo texto + tipo, sin multimedia, sin hashtags, sin moderación IA, con likes (sin comentarios todavía).
- Perfil de Miembro: XP, entrenamientos completados, PRs (dato real reutilizando `EvolutionService`) — **sin** "Adherencia Promedio" ni "Sugerencias IA aceptadas" (ambos dependen de gaps sin resolver, ver §6).
- Invitar por código (sin contactos, sin búsqueda pública).
- **Explícitamente fuera del MVP**: Retos y Eventos completos, Administrar Escuadrón (toggles de privacidad/moderación/roles), invitación por contactos, búsqueda de escuadrones públicos, insignias/logros, "Comparar estadísticas", "Enviar reconocimiento", doble XP premium.

## 14. Alcance v1.1

- Retos y Eventos (progreso grupal + individual, RSVP a eventos).
- Rol Co-Líder y permisos diferenciados.
- Administrar Escuadrón completo (privacidad, toggles, disolver).
- Invitación por contactos del dispositivo (`expo-contacts` + matching backend).
- Búsqueda y descubrimiento de escuadrones públicos.
- Comentarios en posts del feed (hoy solo hay un contador, sin hilo).
- Insignias/logros (`SquadAchievement`).
- Moderación IA automática (si se decide integrar un servicio real de moderación).
- Vínculo con Pagos: doble XP para el plan "GymIA Squad Elite" (bloqueado hasta que exista el sistema de suscripciones).
- "Adherencia Promedio" y "Sugerencias IA aceptadas" en Perfil de Miembro, una vez que esos conceptos se resuelvan a nivel individual en Evolución/Nutrición.

## 15. Riesgos

1. **Ruptura del aislamiento por usuario — el riesgo más grande, por lejos.** Todo el backend actual (`WorkoutSession`, `BodyMetric`, `Meal`, `NutritionGoal`, `OnboardingProfile`, todo) está diseñado bajo el supuesto de que un usuario nunca ve datos de otro. Escuadrón exige romper ese supuesto de forma controlada y auditable. Un error aquí (un endpoint mal filtrado, una query sin `squadId` en el `WHERE`) expondría datos privados de un usuario a otro — no es un bug cosmético, es una fuga de privacidad real.
2. **Privacidad de "Adherencia Promedio" y racha entre usuarios.** Mostrar el % de adherencia de otra persona (aunque sea un compañero de equipo) es una decisión de producto con implicaciones de privacidad que Figma no discute — ¿puede un usuario ocultarlo? ¿Qué pasa si su adherencia es mala y no quiere que el equipo lo vea?
3. **Contactos del dispositivo.** "Contactos Sugeridos" implica subir la agenda del usuario (o parte de ella) al backend para hacer matching — la superficie de privacidad más sensible de toda la app hasta ahora, y no tiene precedente en ningún otro flujo ya construido.
4. **Motor de XP/rachas/rango inexistente.** No hay una sola fórmula definida en ningún lugar del proyecto — hay que inventarla desde cero, con las implicaciones de balance de juego (gamificación mal calibrada desmotiva en vez de motivar) que eso conlleva. Este riesgo es de producto, no solo técnico.
5. **Dependencia de Pagos no resuelta.** El beneficio de "doble XP" ancla parte del valor de Escuadrón a un sistema de suscripciones que todavía no existe ni está diseñado (gap ya documentado, sin fecha).
6. **Moderación de contenido generado por usuarios sin moderación real.** Un feed público-dentro-del-escuadrón con fotos y texto libre, sin un servicio de moderación real construido, es una superficie de abuso (contenido inapropiado, acoso entre miembros) que hoy no tiene ninguna mitigación técnica más allá de un toggle de UI ("Moderación IA automática") sin motor detrás.
7. **Flujo de entrada no diseñado.** Como se señaló en §3, no existe una pantalla de creación de escuadrón ni de "usuario sin escuadrón" en todo el archivo de Figma — cualquier implementación tendrá que **inventar** ese flujo inicial, lo cual contradice directamente la regla de "Figma es la fuente de verdad, no inventar pantallas". Antes de construir nada de Escuadrón, alguien tiene que decidir y (idealmente) diseñar esa pantalla faltante.
8. **Tamaño del módulo.** Contando modelos nuevos, motor de XP, moderación, contactos, feed con media, retos con dos tipos de progreso, eventos con RSVP y permisos por rol — Escuadrón es, por alcance, comparable o mayor que Sueño/Descanso (el otro módulo completo pendiente de decisión de producto) y bastante mayor que cualquier gap individual ya documentado en Evolución o Nutrición. No es una "pantalla más" — es el módulo más grande de todos los pendientes.
