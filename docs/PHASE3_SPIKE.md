# Fase 3 — Spike Técnico: Nutrición vs. Composición Corporal

**Fecha:** 2026-09-24
**Tipo de documento:** investigación y diseño técnico. **No incluye código** — solo análisis, diseño de esquema y estimaciones para decidir el siguiente módulo principal de GymIA.
**Estado previo:** Auth, Entrenar y Evolución están completos y auditados (`docs/PROJECT_STATUS.md`). Este spike resuelve la decisión pendiente marcada en el "Próximo sprint recomendado".
**Fuente de evidencia:** Figma "Final-Pro" (`fileKey=O4cXfRJ7qCbKuH3Jdon00k`) — se localizaron y revisaron diseños reales para ambas opciones (`Gymia-Nutrition-Ecosystem-Board`, nodo `115:4430`; `composicion-corporal`, nodo `147:5903`), no solo el shortcut deshabilitado ya visible en `evolucion/index.tsx`.

---

## 1. Objetivo de negocio

Extender GymIA más allá del registro de entrenamiento (Entrenar) y su análisis (Evolución) hacia una segunda dimensión de valor — alimentación o composición física — para aumentar la frecuencia de apertura de la app (hoy limitada a días de entrenamiento) y diferenciarse de competidores de solo-registro-de-pesas. El objetivo no es "añadir una feature más", sino identificar cuál de las dos opciones genera el mayor retorno de retención por unidad de esfuerzo de ingeniería, dado el estado actual del equipo (una persona, sin infraestructura de IA/visión todavía).

## 2. Valor para el usuario

- **Nutrición**: cierra el ciclo "entreno duro pero no sé si como bien para mis objetivos" — hoy GymIA no dice nada sobre alimentación, el hueco de valor más grande frente a competidores como MyFitnessPal o Fitia.
- **Composición Corporal**: responde a la pregunta que más engancha emocionalmente a un usuario de fitness — "¿se nota el cambio?" — con evidencia objetiva (peso, % grasa, medidas, fotos comparativas) en vez de depender solo de percepción subjetiva. Es el tipo de dato que impulsa el compartir en redes y la percepción de progreso real.

Ambos valores son reales y complementarios; la pregunta del spike es cuál capturarlo primero sin sobreextender el alcance de un equipo de una persona.

## 3. Dependencias técnicas

| Dependencia | Nutrición | Composición Corporal |
|---|---|---|
| Modelo de visión/IA para reconocimiento de alimentos en foto | **Sí, crítico** (Figma muestra "Análisis Vision+" identificando platillos por foto con nivel de confianza) | No |
| Base de datos de alimentos + códigos de barra internacional | **Sí, crítico** (Figma muestra escaneo de código EAN con estado "Sin Coincidencias en Caché" — implica una BD externa real) | No |
| Almacenamiento de imágenes (fotos de progreso) | No | **Sí**, pero trivial — mismo patrón que cualquier upload de imagen (bucket + URL) |
| Sincronización offline-first con resolución de conflictos | **Sí** (Figma muestra explícitamente una pantalla "Conflicto de versión: Conservar local / Descargar la nube") | No |
| Motor de cálculo de macros/calorías | **Sí** | No — reutiliza el patrón de agregación semanal ya construido en `EvolutionService` |
| Nuevas tablas Prisma | 4-5 (ver sección 6) | 2 (ver sección 6) |
| Nuevas dependencias mobile (cámara, escáner de códigos) | `expo-camera`, `expo-barcode-scanner` o equivalente | `expo-image-picker` (probablemente ya suficiente para fotos de progreso) |

**Hallazgo clave del spike**: Nutrición, tal como está diseñada en Figma, no es "una pantalla de registro de comidas" — es un ecosistema con IA de visión, escaneo de códigos de barra contra una base de datos internacional, caché offline y resolución de conflictos de sincronización. Composición Corporal es, en cambio, una extensión directa y de bajo riesgo del módulo Evolución ya existente.

## 4. Cambios requeridos en API

### Nutrición
- Nuevo módulo `src/nutrition/` (módulo, controller, service, DTOs) siguiendo el patrón de `workouts`/`evolution`.
- Integración con un proveedor externo de reconocimiento de alimentos por imagen (ej. un modelo de visión vía API — no hay uno contratado todavía; requiere spike de proveedor aparte).
- Integración con una base de datos de alimentos por código de barras (ej. Open Food Facts u otro proveedor — evaluación de licencia/costo pendiente).
- Endpoint de resolución de conflictos de sincronización (registro creado offline vs. servidor) — lógica no trivial, nueva para el proyecto.
- Motor de cálculo de macros diarios/semanales.

### Composición Corporal
- Nuevo módulo `src/body-metrics/` (o extender `src/evolution/` con un sub-recurso) — mismo patrón que ya existe, sin piezas nuevas de infraestructura.
- Endpoint de subida de fotos de progreso — requiere decidir almacenamiento (Supabase Storage es la opción natural, dado que ya se usa Supabase para Postgres).
- Sin integraciones externas nuevas.

## 5. Cambios requeridos en Mobile

### Nutrición
- Reemplazar `(app)/nutricion.tsx` (hoy `PlaceholderScreen`) por un flujo completo de varias pantallas: dashboard diario, biblioteca de recetas, escáner de cámara (foto + código de barras), registro manual, ajustes de nutrición.
- Nuevos permisos nativos: cámara (ya cubierto por patrones de Expo, pero requiere manejo de "Acceso Denegado a Cámara", ya contemplado en el Figma).
- Lógica de estado offline-first con cola de sincronización — patrón nuevo para el proyecto (hoy todo mobile asume conexión activa).

### Composición Corporal
- Nueva pantalla dentro de `(app)/evolucion/` (ej. `cuerpo.tsx`), activando el shortcut `{ key: 'cuerpo', ... enabled: false }` que **ya existe** en `evolucion/index.tsx` — literalmente ya está reservado el lugar en la UI.
- Formulario de registro de medición (peso, % grasa, masa magra, cintura) + selector de fotos (`expo-image-picker`, comparación lado a lado "Hace 1 mes" vs. "Hoy").
- Reutiliza `LineChart` (ya construido para Evolución) para graficar tendencia de peso/medidas en el tiempo — cero componentes nuevos de visualización.

## 6. Tablas Prisma nuevas

### Opción Nutrición (diseño, no aplicado)

```prisma
model FoodItem {
  id           String   @id @default(uuid())
  name         String
  barcode      String?  @unique
  caloriesKcal Float
  proteinG     Float
  carbsG       Float
  fatG         Float
  source       String   // "manual" | "barcode_db" | "vision_ai"
  createdAt    DateTime @default(now())
}

model MealLog {
  id          String   @id @default(uuid())
  userId      String
  loggedAt    DateTime @default(now())
  mealType    String   // "desayuno" | "comida" | "cena" | "snack"
  syncStatus  String   @default("synced") // "pending" | "synced" | "conflict"

  user    User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries MealLogEntry[]

  @@index([userId])
}

model MealLogEntry {
  id         String @id @default(uuid())
  mealLogId  String
  foodItemId String
  quantityG  Float

  mealLog  MealLog  @relation(fields: [mealLogId], references: [id], onDelete: Cascade)
  foodItem FoodItem @relation(fields: [foodItemId], references: [id])

  @@index([mealLogId])
  @@index([foodItemId])
}

model SavedRecipe {
  id        String   @id @default(uuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  ingredients RecipeIngredient[]

  @@index([userId])
}

model RecipeIngredient {
  id         String @id @default(uuid())
  recipeId   String
  foodItemId String
  quantityG  Float

  recipe   SavedRecipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  foodItem FoodItem    @relation(fields: [foodItemId], references: [id])

  @@index([recipeId])
}
```
5 modelos nuevos, con `FoodItem` compartido (catálogo global, como `Exercise` hoy) y 4 modelos propiedad de usuario con relación explícita a `User`.

### Opción Composición Corporal (diseño, no aplicado)

```prisma
model BodyMetric {
  id           String   @id @default(uuid())
  userId       String
  recordedAt   DateTime @default(now())
  weightKg     Float?
  bodyFatPct   Float?
  leanMassKg   Float?
  waistCm      Float?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model ProgressPhoto {
  id         String   @id @default(uuid())
  userId     String
  storageUrl String
  takenAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
2 modelos nuevos, mismo patrón exacto que los modelos existentes de Entrenar/Evolución (relación directa a `User`, cascade, índice en `userId`).

## 7. Endpoints nuevos

### Nutrición
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/nutrition/summary` | Resumen diario de calorías/macros |
| `POST` | `/nutrition/meals` | Registra una comida (manual) |
| `POST` | `/nutrition/meals/scan-barcode` | Busca alimento por código de barras |
| `POST` | `/nutrition/meals/scan-photo` | Envía foto para reconocimiento por IA |
| `GET` | `/nutrition/recipes` | Lista recetas guardadas del usuario |
| `POST` | `/nutrition/recipes` | Crea receta guardada |
| `POST` | `/nutrition/sync/resolve` | Resuelve conflicto de sincronización offline |

7 endpoints nuevos, 2 de ellos (`scan-photo`, `sync/resolve`) con lógica no trivial.

### Composición Corporal
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/body-metrics` | Historial de mediciones del usuario |
| `POST` | `/body-metrics` | Registra una nueva medición |
| `POST` | `/body-metrics/photos` | Sube una foto de progreso |
| `GET` | `/body-metrics/photos` | Lista fotos de progreso del usuario |

4 endpoints nuevos, todos CRUD simple sobre el patrón ya validado en Entrenar/Evolución.

## 8. Complejidad estimada

| Opción | Complejidad | Justificación |
|---|---|---|
| **Nutrición** | **L** (Large) | Requiere infraestructura nueva (proveedor de visión IA, base de datos de alimentos con licenciamiento a evaluar, sincronización offline con resolución de conflictos) que no existe en el proyecto hoy — no es solo escribir módulos NestJS/Expo, es integrar sistemas externos inciertos. |
| **Composición Corporal** | **S** (Small) | Mismo patrón arquitectónico que Entrenar/Evolución, ya validado dos veces en este proyecto. Sin integraciones externas nuevas salvo almacenamiento de imágenes (trivial con Supabase Storage). |

## 9. Riesgos

### Nutrición
- **Proveedor de IA de visión no evaluado ni contratado** — costo, latencia y precisión desconocidos; riesgo de sub-entregar frente a lo que muestra el Figma (que asume alta precisión con manejo elegante de baja confianza, ej. "¿No corresponde?" en el diseño).
- **Base de datos de alimentos por código de barras**: opciones como Open Food Facts son gratuitas pero con cobertura desigual por país (riesgo real para un mercado no angloparlante); opciones comerciales tienen costo recurrente por request.
- **Sincronización offline-first con resolución de conflictos** es una pieza de arquitectura nueva y genuinamente compleja — ningún otro módulo del proyecto la necesita hoy; alto riesgo de subestimar el esfuerzo.
- **Alcance de UI mucho mayor** (7+ pantallas nuevas en Figma) — más superficie para desviación de fidelidad visual y bugs.

### Composición Corporal
- **Riesgo bajo en general.** El único riesgo real es de producto, no técnico: fotos de progreso son datos sensibles (imágenes corporales del usuario) — requiere decisión explícita sobre privacidad/almacenamiento (¿bucket privado con URLs firmadas? ¿el usuario puede borrar sus fotos?) antes de implementar, no después.
- Métricas manuales (peso, % grasa, cintura) dependen de que el usuario las mida con una báscula/cinta externa — sin integración de wearables (fuera de alcance MVP, ya descartado desde Fase 2).

## 10. MVP mínimo

### Nutrición — MVP mínimo
- Registro **manual** de comidas (nombre + macros ingresados a mano) — **sin** escaneo de código de barras ni IA de visión en la primera entrega.
- Resumen diario de calorías/macros (reutilizando el patrón de agregación de `EvolutionService`).
- Sin recetas guardadas, sin sincronización offline (asumir conexión activa, como el resto de la app hoy).
- Esto reduce la complejidad de L a aproximadamente M, pero **deja fuera el valor diferencial** que muestra el Figma (escaneo por foto) — el MVP recortado compite directamente con MyFitnessPal sin ninguna ventaja.

### Composición Corporal — MVP mínimo
- Formulario de registro de medición (peso, % grasa, masa magra, cintura) + historial en lista.
- Gráfico de tendencia de peso en el tiempo (reutilizando `LineChart` tal cual).
- Fotos de progreso con comparación simple de 2 fotos (más reciente vs. una seleccionada) — sin galería compleja ni edición.
- Este MVP **sí** captura la mayoría del valor percibido del diseño completo de Figma.

## 11. Evolución futura

### Nutrición
- Escaneo de código de barras contra base de datos externa.
- Reconocimiento de alimentos por foto (IA de visión).
- Recetas adaptativas y biblioteca personal.
- Sincronización offline con resolución de conflictos.
- Correlación cruzada con Entrenar/Evolución (ej. "tu volumen de entrenamiento subió pero tu ingesta de proteína no acompañó").

### Composición Corporal
- Integración con básculas inteligentes/wearables (Bluetooth) — descartado en Fase 2, sigue fuera de alcance.
- Análisis de tendencia asistido (ej. detección automática de estancamiento).
- Comparación de fotos con overlay/alineación automática.
- Integración con Evolución General (hoy el shortcut "Cuerpo" ya vive ahí — la puntuación de progreso podría incorporar composición corporal como cuarta señal, junto a frecuencia y volumen).

## 12. Recomendación final

## Tabla comparativa

| Criterio | Nutrición | Composición Corporal |
|---|---|---|
| Alcance MVP | Registro manual + resumen diario (recorta el diferencial real del Figma) | Métricas + fotos de progreso + gráfico de tendencia (captura casi todo el valor del diseño) |
| Tiempo estimado (MVP) | 3–4 semanas | 1–1.5 semanas |
| Datos necesarios | Catálogo de alimentos (a construir o licenciar), macros por alimento | Ninguno externo — solo lo que el usuario ingresa |
| UX requerida | 7+ pantallas nuevas (dashboard, recetas, escáner, ajustes) | 1–2 pantallas nuevas, reutilizando componentes existentes |
| Potencial para IA futura | **Muy alto** — es el módulo con más superficie de IA de todo el roadmap (visión, recomendación de recetas, correlación con entrenamiento) | Medio — detección de estancamiento, análisis de tendencia asistido, pero menos transformador |
| Complejidad | **L** | **S** |
| Riesgo técnico | Alto (dependencias externas inciertas) | Bajo |
| Nuevas tablas Prisma | 5 | 2 |
| Nuevos endpoints | 7 | 4 |
| Dependencias nuevas de mobile | Cámara + escáner de códigos + arquitectura offline | Selector de imágenes (trivial) |

### Recomendación

**Construir Composición Corporal primero, como Fase 3; dejar Nutrición para Fase 4** con un spike de proveedor de IA de visión y de base de datos de alimentos como paso previo obligatorio (no como parte del sprint de implementación).

Razones:
1. **Relación esfuerzo/valor muy superior**: 1–1.5 semanas vs. 3–4 semanas para un MVP que, en Nutrición, ni siquiera captura el diferencial (escaneo por IA) que justificaría el esfuerzo.
2. **Cero riesgo de infraestructura desconocida** — Composición Corporal reutiliza exactamente el patrón arquitectónico (Prisma + NestJS + `LineChart`) que ya se validó dos veces con éxito en Entrenar y Evolución.
3. **El lugar en la UI ya está reservado** (`{ key: 'cuerpo', enabled: false }` en `evolucion/index.tsx`) — es, literalmente, la extensión con menos fricción de todo el roadmap.
4. **Nutrición "bien hecha" (con IA de visión) es demasiado valiosa para recortar** — lanzar una versión manual sin el diferencial de Figma arriesga decepcionar expectativas sin ganar ventaja competitiva real. Mejor invertir un spike de proveedor dedicado antes de comprometer un sprint completo.
5. Composición Corporal también **alimenta directamente** la fórmula de `progressScore` de Evolución (deuda técnica ya identificada — "heurística sin validar") con una señal adicional real, mejorando un módulo ya existente en vez de solo añadir uno nuevo.

## Roadmap — próximas 4 semanas

**Semana 1 — Composición Corporal (backend + diseño de datos)**
- Migración Prisma: `BodyMetric`, `ProgressPhoto`.
- Decisión y configuración de almacenamiento de fotos (Supabase Storage, bucket privado, política de acceso).
- Módulo `body-metrics` completo (4 endpoints), con `JwtAuthGuard` y filtrado por usuario desde el día uno.
- Tests unitarios del nuevo servicio (cerrando también parte de la deuda de testing ya documentada en `NEXT_STEPS.md`).

**Semana 2 — Composición Corporal (frontend + integración)**
- Pantalla `evolucion/cuerpo.tsx`: formulario de medición + historial + `LineChart` de tendencia.
- Flujo de fotos de progreso (selección, subida, comparación simple).
- Activar el shortcut `Cuerpo` en `evolucion/index.tsx` (`enabled: true`).
- Verificación end-to-end en vivo (mismo patrón usado para auditar Evolución) + `docs/BODY_COMPOSITION_MVP_STATUS.md`.

**Semana 3 — Cierre de deuda técnica crítica + spike de Nutrición**
- Ejecutar ítems P0/P1 pendientes de `NEXT_STEPS.md` que llevan varias sesiones postergados: `.env.example`, rate limiting en auth, CORS restringido.
- Spike dedicado (sin comprometer sprint de producto): evaluar 2-3 proveedores de IA de visión para reconocimiento de alimentos (costo, latencia, precisión) y 2-3 fuentes de base de datos de alimentos con códigos de barra (cobertura, licencia, costo). Producir una recomendación, no código.

**Semana 4 — Plan detallado de Nutrición MVP**
- Con el spike de proveedores resuelto, definir el alcance real del MVP de Nutrición (con o sin IA de visión según lo que el spike de la Semana 3 concluya sobre viabilidad/costo).
- Documento de diseño técnico equivalente al usado para Entrenar/Evolución (schema final para revisión, endpoints, plan de migración) — listo para iniciar implementación en la Fase 4.
