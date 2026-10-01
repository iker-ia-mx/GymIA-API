# Sueño + Escuadrón — Decisiones de Producto Compartidas

**Fecha:** 2026-09-25 (decisiones aprobadas por el usuario el mismo día)
**Fuente:** `docs/SLEEP_PRODUCT_SPEC.md`, `docs/ESCUADRON_PRODUCT_SPEC.md`, `docs/FIGMA_TO_APP_MASTER_PLAN.md` §1.7/§1.9/§3/§4. **Estado: decisiones aprobadas — este documento ya no es un análisis de opciones, es el registro de lo decidido.** Sigue sin implementarse nada y sin commits; la aprobación es de producto, no de código.

**Por qué este documento existe:** las dos especificaciones ya identificaron que Sueño y Escuadrón comparten dos bloqueadores reales que Figma mismo no resuelve — un conflicto de navegación (§1) y una dependencia de datos cruzada (§2) — más dos vacíos de diseño dentro del propio Escuadrón que hay que resolver antes de poder construir nada (§3). Este documento no vuelve a Figma a buscar más pantallas; toma lo ya encontrado y propone caminos concretos.

---

## 1. Conflicto de navegación — ✅ DECIDIDO

**Se aprobó la Alternativa 2 como MVP, con migración futura planeada a la Alternativa 3 cuando Escuadrón exista.** Las 3 alternativas quedan documentadas abajo como el análisis que sustentó la decisión.

### El hallazgo exacto (de `docs/SLEEP_PRODUCT_SPEC.md` §9.8)

El archivo de Figma tiene **3 variantes distintas** del bottom-nav de 5 posiciones, y ninguna muestra los 6 destinos posibles a la vez:

| Variante | Pantallas donde aparece | Posiciones |
|---|---|---|
| (a) | Evolución, Perfil (secciones 147/150 ya auditadas) | Evolución / Entrenar / Nutrición / **Escuadrón** / Perfil |
| (b) | Canvas original de Sueño (`160:`) | Evolución / Entrenar / Nutrición / **Sueño** / **Escuadrón** *(sin Perfil)* |
| (c) | Canvas de extensión de Sueño (`171:`) | Evolución / Entrenar / Nutrición / **Sueño** / Perfil *(sin Escuadrón)* |

Evolución, Entrenar y Nutrición son fijos en las 3. Sueño, Escuadrón y Perfil compiten por las 2 posiciones restantes — nunca los 3 caben. No hay un patrón de overflow ("Más") en ninguna pantalla del archivo. El diseñador nunca resolvió esto; no es un detalle que se nos escapó, es una inconsistencia real en la fuente de verdad.

### Alternativa 1 — Escuadrón en el tab bar, Sueño dentro de Evolución

Bottom nav (5 tabs, igual que hoy + 1): **Evolución / Entrenar / Nutrición / Escuadrón / Perfil** — reutiliza exactamente la variante (a) de Figma, sin inventar un patrón nuevo. Sueño se accede como una tarjeta más dentro del grid de atajos que ya existe en `evolucion/index.tsx` (`SHORTCUTS`, el mismo patrón que ya usan "Fuerza", "Cuerpo" e "Historial").

- **Pros:** cero trabajo de diseño nuevo para el tab bar (variante (a) ya está validada pixel a pixel en las pantallas de Evolución/Perfil que auditamos hoy); Escuadrón obtiene visibilidad de primer nivel, que es lo que un módulo social/de retención necesita para funcionar — una feature social escondida no genera el hábito de uso que busca.
- **Contras:** Sueño pierde visibilidad de primer nivel a pesar de que Figma le dio marca propia fuerte ("SOMNIA AI", identidad visual distinta) — sugiere que el diseñador lo pensó como pilar, no como sub-sección de otro módulo. También es la variante que **menos coincide con el orden ya acordado** (Sueño se implementa antes que Escuadrón, pero en esta alternativa Escuadrón es quien gana el tab).
- **Impacto en UX:** bajo riesgo de sobrecarga del tab bar (se queda en 5, como hoy). Riesgo medio de que Sueño, sin tab propio, tenga menos descubribilidad y por tanto menos adopción — un problema si el objetivo de negocio es que los usuarios conecten un wearable.

### Alternativa 2 — Sueño en el tab bar, Escuadrón dentro de Perfil

Bottom nav (5 tabs): **Evolución / Entrenar / Nutrición / Sueño / Perfil** — reutiliza exactamente la variante (c) de Figma. Escuadrón se accede desde una sección dentro de Perfil (o, si se prefiere más visibilidad, desde un atajo destacado en `perfil/index.tsx`, similar al que ya existe para "Objetivos y Preferencias").

- **Pros:** también reutiliza una variante ya validada de Figma; **coincide exactamente con el orden de prioridad que ya aprobaste** (Sueño se construye primero, así que es razonable que sea el primero en ganar el tab; Escuadrón llega después y puede vivir en un lugar secundario mientras tanto sin bloquear nada). Prioriza el dato biométrico (Sueño) como pilar de la app, coherente con que Evolución ya depende de datos de sueño para resolver `evolucion-error-adherencia`.
- **Contras:** Escuadrón, cuando se construya, pierde la visibilidad de primer nivel que probablemente necesita para tener tracción social — el mismo problema que la Alternativa 1 le causa a Sueño, pero invertido.
- **Impacto en UX:** mismo riesgo bajo de sobrecarga (5 tabs). El riesgo de baja adopción se traslada a Escuadrón en vez de a Sueño — aceptable si Escuadrón de verdad se construye después y no se necesita que compita por atención desde el día uno.

### Alternativa 3 — Tab "Más" como hub de expansión

Bottom nav (5 tabs, uno de ellos es un hub, no un módulo): **Evolución / Entrenar / Nutrición / Más / Perfil**, donde "Más" es una pantalla intermedia con accesos a Sueño, Escuadrón, y cualquier módulo futuro que Figma agregue (el archivo ya tiene un patrón de "atajos" reutilizable, ver `evolucion/index.tsx`).

- **Pros:** es la única alternativa que **escala** — si Figma agrega un séptimo u octavo módulo en el futuro, no hay que rediseñar el tab bar otra vez. No privilegia a Sueño sobre Escuadrón ni viceversa, evitando tener que elegir un "ganador" sin datos de uso real todavía.
- **Contras:** es la única alternativa que **no reutiliza ninguna variante de Figma tal cual** — el ícono/pantalla "Más" no existe en el archivo, sería el único elemento de navegación genuinamente nuevo de las 3 opciones (aunque el patrón "Más"/hub de expansión es estándar de la industria, no específico de este diseño, así que no es "inventar una pantalla" en el sentido que preocupa al resto del proyecto — es un patrón de navegación, no una pantalla de contenido). Añade un tap extra para llegar a Sueño o Escuadrón, lo cual reduce el uso de ambos frente a tenerlos en un tab de primer nivel.
- **Impacto en UX:** mejor a largo plazo, peor a corto plazo — más fricción para las dos features nuevas mientras se intenta demostrar su valor.

**Decisión final:** Bottom nav MVP = **Evolución / Entrenar / Nutrición / Sueño / Perfil** (Alternativa 2). Escuadrón, mientras no tenga tab propio, se accede desde una sección/atajo dentro de Perfil. Cuando Escuadrón esté listo para construirse, se migra a un tab "Más" (Alternativa 3) que aloje Sueño y Escuadrón juntos, en vez de forzar los 6 destinos en 5 posiciones.

---

## 2. Dependencia cruzada Sueño → Escuadrón — ✅ DECIDIDO

### Dónde ocurre exactamente

Dos menciones textuales, ambas en pantallas de Sueño, ninguna en pantallas de Escuadrón:

1. **`171:3104` "Conectar Oura" (conectar-dispositivo)** — el aviso de privacidad dice literalmente: *"Tus datos biométricos se procesan localmente para calibrar tu prescripción de entrenamiento en el Escuadrón."*
2. **`171:3198` "Fuentes y Diagnóstico" (diagnostico-fuentes)** — la sección de troubleshooting está titulada: *"¿Faltan datos en el Escuadrón?"*

### Qué datos necesita exactamente uno del otro

Leyendo el sentido literal de ambas frases, la dependencia va **en una sola dirección: Sueño alimenta a Escuadrón, no al revés.**

- Sueño **no necesita ningún dato de Escuadrón** para funcionar — ninguna de las 6 pantallas de Sueño lee, muestra o depende de membresía de escuadrón, roles, feed, ni ningún otro dato de `docs/ESCUADRON_PRODUCT_SPEC.md`.
- Lo que sí implican esas 2 frases es que, **si Escuadrón existiera**, querría **leer** datos de Sueño de sus miembros (para mostrarlos en `Perfil de Miembro` o para calibrar algo del lado de Escuadrón) — es Escuadrón quien depende de Sueño como fuente, no Sueño quien depende de Escuadrón.
- Esto es una buena noticia práctica: **Sueño se puede construir de forma completamente autónoma.** El único ajuste necesario es de copy, no de arquitectura ni de datos.

### MVP de Sueño desacoplado de Escuadrón (propuesta concreta)

Construir las 6 pantallas (o el subconjunto MVP ya propuesto en `docs/SLEEP_PRODUCT_SPEC.md` §8) exactamente como están especificadas, con un solo ajuste de honestidad — el mismo tipo de ajuste ya aplicado 5 veces en este proyecto (ver `FIGMA_TO_APP_MASTER_PLAN.md` §1.3, §1.8):

- En `conectar-dispositivo`: *"Tus datos biométricos se procesan localmente para calibrar tu prescripción de entrenamiento en el Escuadrón"* → **"Tus datos biométricos se procesan localmente para calibrar tu prescripción de entrenamiento"** (se omite la cláusula de Escuadrón porque el módulo no existe todavía; el resto de la frase es cierto y no depende de nada más).
- En `diagnostico-fuentes`: el troubleshooting *"¿Faltan datos en el Escuadrón?"* → se omite esa entrada específica del troubleshooting (las otras entradas de esa pantalla, sobre duplicados y prioridad de fuentes, no mencionan Escuadrón y se mantienen intactas).

Ningún otro cambio de alcance es necesario. Cuando Escuadrón se construya (después, según el orden acordado), esas 2 líneas de copy se restauran y se conecta el endpoint real que Escuadrón necesite para leer datos de Sueño de sus miembros — trabajo nuevo en ese momento, no deuda técnica generada ahora.

**Decisión final:** MVP de Sueño según `docs/SLEEP_PRODUCT_SPEC.md` §8, con el ajuste de copy de arriba aplicado desde el primer commit — Sueño nunca menciona Escuadrón en su MVP.

---

## 3. Escuadrón — vacíos de diseño y política de privacidad — ✅ DECIDIDO

### Cómo crear el primer escuadrón

Figma no tiene esta pantalla (`docs/ESCUADRON_PRODUCT_SPEC.md` §3, "Gap de entrada al flujo — el más importante de señalar"). Propuesta que no inventa UI nueva: **adaptar los campos que ya existen en `Administrar Escuadrón` (`138:6522`)** — esa pantalla ya tiene nombre de equipo (editable), toggle de privacidad, y permisos — son exactamente los campos que una pantalla de creación necesita, solo que hoy están enmarcados como "editar un escuadrón existente" en vez de "crear uno nuevo". Reutilizar ese layout con los campos vacíos y el botón principal cambiado a "Crear Escuadrón" es la opción más fiel al lenguaje visual que Figma ya estableció, en vez de diseñar una pantalla desde cero.

### Cómo unirse al primer escuadrón

`Invitar y Unirse` (`138:6436`) ya tiene un buscador de escuadrones públicos y un mecanismo de código/QR — hoy enmarcado como "expandir un escuadrón existente" (según el copy "Expande la comunidad Alpha" citado en la spec), pero el componente de UI en sí (buscar/unirse por código) es idéntico a lo que necesita un usuario sin escuadrón. Propuesta: la misma pantalla, alcanzable también desde un estado "sin escuadrón todavía" (ver abajo), sin necesitar una segunda pantalla.

### Estado vacío "sin escuadrón todavía"

Ninguna de las 8 pantallas cubre esto tampoco. Propuesta: reutilizar el componente `SystemStateScreen` (`src/components/system/`, ya usado por las 11 pantallas de sistema de Fase 1) con 2 CTAs: "Crear Escuadrón" y "Unirse con código" — consistente con el patrón que la app ya usa para cualquier estado vacío, en vez de inventar un tratamiento visual nuevo solo para Escuadrón.

### Política de privacidad recomendada, por tipo de dato

Principio original propuesto: "privado por defecto; visible al equipo solo con acción explícita". **El usuario decidió un enfoque más permisivo para las métricas de rendimiento (adherencia/rachas/PRs), manteniendo el principio estricto solo para contenido personal (progreso corporal/nutrición):**

| Dato | Decisión aprobada | Razonamiento original (contexto, no bloquea la decisión tomada) |
|---|---|---|
| **Adherencia** | ✅ **Visible para el Escuadrón** (por defecto, sin opt-in) | Se había recomendado ocultarla por defecto por el riesgo #2 de `ESCUADRON_PRODUCT_SPEC.md` (métrica que puede avergonzar). El usuario prioriza la presión social positiva como mecanismo de accountability — coherente con el objetivo del módulo descrito en su propia spec (§2: "adherencia por presión social positiva") |
| **Rachas** | ✅ **Visibles para el Escuadrón** (por defecto) | Coincide con la recomendación original — las rachas son, por diseño, una señal social/competitiva |
| **PRs (récords personales)** | ✅ **Visibles para el Escuadrón** (por defecto) | Coincide con la recomendación original — coherente con que la app ya ofrece compartir un PR como acción explícita al finalizar una sesión |
| **Progreso corporal** (fotos, peso, % grasa) | 🔒 **Privado por defecto**, solo compartido mediante publicación explícita (tipo "Progreso" en Crear Publicación) | Coincide con la recomendación original — `ProgressPhoto` hoy es estrictamente privada; compartir debe ser un acto deliberado |
| **Nutrición** (comidas, macros) | 🔒 **Privada por defecto**, solo compartida mediante publicación explícita (tipo "Comida" en Crear Publicación) | Coincide con la recomendación original — mismo tratamiento que progreso corporal |

**Nota de implementación importante, no relacionada con la decisión de producto en sí:** con adherencia visible por defecto, el gap de `evolucion-error-adherencia` (fórmula de adherencia sin definir, ver `FIGMA_TO_APP_MASTER_PLAN.md` §4) se vuelve un prerequisito más directo de Escuadrón de lo que ya era — antes de mostrar "Adherencia Promedio 94%" en `Perfil de Miembro`, tiene que existir una fórmula real que calcularla, individual primero, expuesta entre usuarios después. No se resuelve en este documento; sigue como gap abierto.

---

## 4. Plan aprobado (resumen ejecutable)

**Navegación:** enfoque por fases.
- **MVP (ahora, cuando se construya Sueño):** Alternativa 2 — Evolución / Entrenar / Nutrición / **Sueño** / Perfil. Escuadrón, hasta que se construya, no tiene tab; se accede desde Perfil.
- **Migración futura (cuando Escuadrón esté listo para construirse):** Alternativa 3 — tab "Más" que aloje Sueño y Escuadrón juntos (y cualquier módulo futuro), reemplazando el tab dedicado de Sueño.

**MVP de Sueño (aprobado):** el propuesto en `docs/SLEEP_PRODUCT_SPEC.md` §8 (una sola fuente nativa — Apple Health o Health Connect, no ambas; sin tracking en vivo con sensores propios; resto de proveedores como "Próximamente"), **con el ajuste de copy de §2 aplicado desde el primer commit** (nunca menciona Escuadrón). Cubre 2 de las 6 pantallas catalogadas (`sueño-conectado-inicio` simplificada, `apps-y-relojes` con una fuente activa) — el resto queda fuera del MVP, ver `SLEEP_PRODUCT_SPEC.md` §8 para el detalle completo de qué se excluye y por qué.

**MVP de Escuadrón (aprobado):**
1. Crear escuadrón (pantalla nueva, adaptada de los campos de `Administrar Escuadrón`).
2. Unirse mediante código/invitación (reutiliza `Invitar y Unirse`, sin contactos ni búsqueda pública).
3. Estado vacío "sin escuadrón todavía" (`SystemStateScreen`, CTAs Crear/Unirse).
4. Squad + SquadMembership (roles Líder/Miembro), Hub simplificado, Miembros sin solicitudes pendientes, Feed solo texto, Perfil de Miembro con **Adherencia/Rachas/PRs visibles** (política de privacidad aprobada en §3) pero **sin** "Sugerencias IA aceptadas" (evento no instrumentado en ningún lado del backend, gap distinto al de privacidad).
5. Fuera del MVP: Retos y Eventos, Administrar Escuadrón completo (privacidad/moderación/roles), invitación por contactos, búsqueda pública, insignias, "Comparar estadísticas"/"Enviar reconocimiento", doble XP premium.

Sigue en pie el prerequisito arquitectónico de fondo, sin resolver por ninguna decisión de este documento: el riesgo #1 de `ESCUADRON_PRODUCT_SPEC.md` (romper el aislamiento por `userId`) tiene que resolverse técnicamente antes de escribir la primera línea de código de Escuadrón, independientemente del MVP acordado.

**Siguiente paso:** ver `FIGMA_TO_APP_MASTER_PLAN.md` §5/§6 para el impacto estimado en la paridad Figma y el orden de implementación actualizado. Ningún código ni commit todavía — pendiente de tu revisión de la documentación actualizada.
