# Nutrición — Plan Técnico Completo

**Fecha:** 2026-09-24
**Tipo de documento:** diseño técnico completo, previo a implementación. **No incluye código** — es la base para la revisión antes de escribir el módulo (Semanas 5-8 de Fase 3, según `docs/PHASE3_SPIKE.md`).
**Construye sobre:** `docs/NUTRITION_SPIKE.md` (spike inicial de Semana 3) y el diseño de Figma ya explorado (`Gymia-Nutrition-Ecosystem-Board`, `Nutrition-IA`).
**Fuentes de precios/cobertura:** búsquedas web realizadas en esta sesión (septiembre 2026), citadas al final del documento — son orientativas, deben reconfirmarse contra documentación oficial antes de comprometer presupuesto o contrato.

---

# 1. Objetivo de producto

## Problema que resuelve

GymIA hoy responde "¿qué tan bien estoy entrenando?" (Entrenar, Evolución) y "¿cómo está cambiando mi cuerpo?" (Composición Corporal), pero no responde la pregunta que más determina si esos dos esfuerzos dan resultado: **¿estoy comiendo de forma consistente con mi objetivo?** Es el hueco de valor más grande frente a competidores (MyFitnessPal, Fitia, Yazio), identificado ya en la evaluación de Fase 2 (`docs/STATUS.md`) y confirmado como prioridad en el spike de Fase 3.

## Casos de uso principales

1. **Registro rápido de una comida** — el usuario quiere anotar qué comió en menos de 15 segundos, sin fricción, varias veces al día. Es el caso de uso que más se repite y el que más determina si el usuario sigue usando el módulo o lo abandona en una semana.
2. **Reconocer un producto empaquetado por su código de barras** — comida rápida de registrar cuando el alimento ya viene con etiqueta nutricional impresa.
3. **Reconocer un plato preparado (sin empaque) por foto** — el caso de uso diferencial frente a competidores que solo tienen bases de datos de productos empaquetados; cubre comida casera, restaurantes, platos sin código de barras.
4. **Ver si el día/la semana está dentro del objetivo** — resumen diario de calorías/macros contra una meta, mismo patrón visual que ya usa Evolución (barra de progreso, tarjetas de métricas).
5. **Ajustar el objetivo nutricional** cuando cambian las metas de entrenamiento (déficit, mantenimiento, superávit).

## Cómo encaja con Entrenar, Evolución y Composición Corporal

- **Entrenar**: no hay integración de datos en el MVP (evitar acoplamiento innecesario), pero el diseño de Figma (`Nutrition-IA`) ya insinúa una futura correlación — "Diseño de macros calibrado... en base a tu entrenamiento activo de hoy" — que se deja explícitamente **fuera de alcance** de este plan (ver sección 10).
- **Evolución**: el resumen nutricional podría, en una fase posterior, sumarse como una cuarta señal a `progressScore` (hoy basado solo en frecuencia y volumen de entrenamiento) — mencionado como oportunidad futura, no implementado aquí.
- **Composición Corporal**: comparten exactamente el mismo patrón arquitectónico (relación directa a `User`, `onDelete: Cascade`, endpoints filtrados por `userId`, `JwtAuthGuard`) — Nutrición es el tercer módulo de negocio construido con esta plantilla, no reinventa nada a nivel de arquitectura base.

---

# 2. Arquitectura

```
Mobile (Expo)
  │
  ├─ Diario nutricional / Historial / Objetivos / Resumen
  │     └─ GET/POST/DELETE /nutrition/*  (JWT, mismo patrón que Entrenar/Evolución)
  │
  ├─ Escáner de código de barras (expo-camera barcode scanning)
  │     └─ POST /nutrition/barcode/scan { code }
  │           └─ NestJS: busca en Food (caché local) → si no existe, consulta
  │              Open Food Facts / USDA → persiste en Food → responde
  │
  └─ Cámara IA (expo-image-picker / expo-camera)
        └─ POST /nutrition/vision/analyze (multipart)
              └─ NestJS: envía la foto a Claude (visión) → normaliza a JSON
                 estructurado → responde candidatos SIN persistir nada
              └─ Usuario confirma/edita → POST /nutrition/meals (igual que
                 un registro manual)
```

**API**: nuevo módulo `src/nutrition/` (`nutrition.module.ts`, `nutrition.service.ts`, `nutrition.controller.ts`, `dto/*`), mismo patrón que `body-composition/`. Dos sub-responsabilidades con acoplamiento bajo entre sí: (a) CRUD de comidas/objetivos sobre Postgres, (b) integraciones externas (proveedor de visión, fuentes de alimentos) — se recomienda un `FoodSourceService` y un `VisionService` separados del `NutritionService` principal, inyectados como providers, para que el CRUD nunca dependa directamente del SDK de un proveedor externo (facilita cambiar de proveedor sin tocar la lógica de negocio).

**Mobile**: mismo patrón ya usado en Composición Corporal — pantallas planas en `src/app/(app)/nutricion-*.tsx` (reemplazando el `PlaceholderScreen` actual de `nutricion.tsx`), cliente API en `src/lib/nutritionApi.ts`, reutilización de `Card`, `PrimaryButton`, `TextField`, `LineChart`.

**IA**: llamada server-side (nunca desde mobile directo al proveedor de IA) — el backend controla el prompt, la clave de API nunca se expone al cliente, y permite cambiar de proveedor sin publicar una nueva versión de la app. Ver sección 4 para la comparación de proveedores.

**Base de datos**: 6 tablas nuevas en el mismo Postgres de Supabase ya usado por todo el proyecto (ver sección 5) — sin infraestructura de base de datos nueva.

**Storage**: reutiliza el mismo patrón de `ProgressPhoto` (bucket privado de Supabase Storage, URLs firmadas) **si se decide guardar las fotos de comida** — decisión de producto/costo pendiente (ver Riesgos de `NUTRITION_SPIKE.md`). Si no se guardan, la foto solo transita en memoria del backend hacia el proveedor de IA y se descarta.

---

# 3. Investigación de proveedores de datos de alimentos

| Proveedor | Cobertura LATAM | Coste | API | Escalabilidad | Ventajas | Desventajas |
|---|---|---|---|---|---|---|
| **Open Food Facts** | Colaborativa/crowdsourced; soporta español y rastrea país de venta, pero **no se encontró ninguna cifra concreta de cobertura para México/LatAm** — es una brecha de evidencia real, no un dato confirmado | Gratis, sin límite documentado | REST simple, sin autenticación para lectura | Alta (CDN propio) pero cobertura depende 100% de contribuciones voluntarias | Gratis, sin vendor lock-in, comunidad activa | **Licencia ODbL con share-alike** — riesgo legal si se combina con datos propios que se quieran mantener cerrados (revisión legal pendiente, ver `NUTRITION_SPIKE.md`); cobertura LATAM no verificada empíricamente |
| **USDA FoodData Central** | Débil — es una base de datos oficial de EE.UU., orientada a alimentos genéricos, no a marcas empaquetadas de LatAm | Gratis con API key de data.gov | REST, 1,000 req/hora (30/hora con demo key) | Buena a nivel MVP, requiere pedir aumento de cuota a escala | Datos oficiales de alta calidad, sin restricción de licencia tipo share-alike, gratis | Cobertura casi nula de productos empaquetados mexicanos/latinoamericanos — sirve como fuente secundaria de alimentos genéricos, no primaria de códigos de barra |
| **FatSecret Platform** | 56+ datasets de país, 26 idiomas — **incluye LatAm según el proveedor**, pero sin cifra específica confirmada en esta investigación | Basic: gratis hasta 5,000 calls/día (self-serve); Premier: requiere contacto comercial, precio no público | REST, bien documentada | Alta — el precio se basa en el dataset (país/idioma) y nivel de soporte, no en volumen, según lo investigado | La única de las 3 gratuitas/semi-gratuitas con cobertura de país explícitamente amplia declarada por el proveedor | Los tiers Premier (con mejor cobertura/soporte) no son self-serve — implica ciclo de ventas antes de poder confirmar precio real |
| **Nutritionix** | No confirmada para LatAm en esta investigación — orientado a EE.UU. | Free: 200 calls/día · Hobby: ~$50/mes (~10k calls/día) · Producción: $500–$2,000+/mes | REST + NLP en lenguaje natural | Buena, con planes escalonados claros | NLP de texto libre es una ventaja real para registro manual rápido ("dos huevos y pan tostado") | Costo de producción alto; cobertura LatAm no confirmada |
| **Edamam Food Database** | No confirmada para LatAm en esta investigación | 700k+ códigos UPC/EAN/ITN; free tier limitado + planes de pago no confirmados con precisión en esta pasada | REST + NLP + análisis de imagen propio | No evaluada en detalle | Incluye su propio análisis de imagen (alternativa a contratar un proveedor de visión aparte) | Precio de producción no confirmado — requiere cotización directa antes de decidir |

**Hallazgo más importante de esta sección**: **ninguna fuente investigada tiene cobertura LATAM confirmada con datos concretos** (números de productos mexicanos, tasa de aciertos real). Esto es una brecha de evidencia, no una conclusión — antes de comprometerse con una fuente como primaria, se recomienda una **prueba empírica**: escanear manualmente 50-100 códigos de barra de productos mexicanos comunes (Bimbo, Coca-Cola México, Sabritas, Lala, etc.) contra Open Food Facts, USDA y la opción Basic de FatSecret, y medir la tasa de aciertos real — más confiable que cualquier cifra de marketing.

---

# 4. Nutrición por IA

## Diseño funcional

- **Reconocimiento por foto**: una foto de un plato → el modelo identifica el/los alimento(s) visibles.
- **Análisis visual**: además del nombre, estimar porciones/gramaje a partir de referencias visuales en la imagen (tamaño de plato, utensilios) — inherentemente impreciso, se comunica como estimado editable, nunca como dato exacto (mismo principio ya aplicado en `BODY_COMPOSITION_DESIGN.md` para las fotos de progreso: nunca auto-guardar sin confirmación).
- **Cálculo estimado de calorías**: a partir del alimento + gramaje estimado, cruzar contra `Food` (catálogo local) si existe una coincidencia razonable, o pedir al propio modelo una estimación de macros si no hay coincidencia — en ambos casos, mostrado como editable antes de guardar.
- **Detección de alimentos múltiples**: un plato con varios componentes (proteína + arroz + ensalada) debe devolver una lista, no un solo ítem — se le pide al modelo explícitamente en el prompt que devuelva un array JSON, no un objeto único. Este es el caso más propenso a error (confundir componentes, omitir uno pequeño) y el que más debe apoyarse en la edición manual post-análisis.

## Comparación de proveedores de visión

| Proveedor | Modelo | Precio orientativo | Notas |
|---|---|---|---|
| **Anthropic (Claude)** | Haiku 4.5 | $1 / $5 por MTok (in/out) — ~$0.002–$0.005 por foto analizada | Salida JSON estructurada confiable; ya es la familia de modelo usada para construir este proyecto (Claude Code), sin que eso por sí solo deba decidir la elección técnica |
| **Anthropic (Claude)** | Sonnet 5 | $2 / $10 por MTok — 2-4× el costo de Haiku | Mejor para casos de baja confianza en cascada (ver MVP) |
| **OpenAI** | GPT-4o | ~$2.50 / $10 por MTok; una imagen en detalle alto puede costar ~$0.0128 solo en tokens de imagen | Visión madura, ampliamente documentada |
| **OpenAI** | GPT-4o mini | **$0.15 / $0.60 por MTok — la opción más barata encontrada en esta investigación**, del orden de $0.0004 por foto analizada | Sorprendentemente competitivo en precio frente a Haiku; candidato serio a bake-off antes de decidir |
| **Google Gemini** | Flash (visión/comprensión) | **No se encontró una cifra confiable y separada de "entender una foto existente"** — las búsquedas devolvieron precios de *generación* de imágenes (Nano Banana / Imagen), que es una tarea distinta y no debe confundirse con analizar una foto que el usuario ya tomó | Requiere una investigación dedicada aparte antes de considerarlo en firme — no incluido en la recomendación final por falta de datos confiables |
| **Azure AI Vision** | Image Analysis | ~$1–$1.50 por 1,000 transacciones (más barato en volumen) | **No es comparable directamente**: es un servicio de etiquetado/objetos genérico (tags, OCR, descripciones), no un modelo conversacional que devuelva "esto es pollo a la plancha con arroz, ~450 kcal" en un solo paso — requeriría construir aparte la lógica de mapeo tag→alimento→macros, trabajo adicional que los proveedores conversacionales (Claude/GPT) resuelven en un solo prompt |

**Conclusión de esta sección**: los modelos conversacionales con visión (Claude, GPT-4o/mini) son la opción correcta para este caso de uso porque devuelven razonamiento estructurado en un solo paso (identificación + estimación + formato JSON), no solo etiquetas. Azure AI Vision resolvería una tarea distinta (clasificación) que necesitaría lógica adicional propia para llegar al mismo resultado. Gemini queda pendiente de una investigación de precios específica antes de descartarlo o incluirlo.

---

# 5. Modelo Prisma propuesto

```prisma
model Food {
  id           String   @id @default(uuid())
  name         String
  brand        String?
  barcode      String?  @unique
  source       String   // "openfoodfacts" | "usda" | "fatsecret" | "manual" | "ai_vision"
  caloriesKcal Float
  proteinG     Float
  carbsG       Float
  fatG         Float
  fiberG       Float?
  sugarG       Float?
  sodiumMg     Float?
  servingSizeG Float?
  createdAt    DateTime @default(now())

  mealItems    MealItem[]
  barcodeScans BarcodeScan[]

  @@index([barcode])
  @@index([source])
}

model Meal {
  id        String   @id @default(uuid())
  userId    String
  mealType  String   // "desayuno" | "comida" | "cena" | "snack"
  loggedAt  DateTime @default(now())
  source    String   @default("manual") // "manual" | "barcode" | "ai_vision"
  photoPath String?  // ruta en Storage si viene de una foto (mismo patrón que ProgressPhoto.storagePath)
  createdAt DateTime @default(now())

  user  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items MealItem[]

  @@index([userId])
  @@index([userId, loggedAt])
}

model MealItem {
  id           String @id @default(uuid())
  mealId       String
  foodId       String
  quantityG    Float
  // Snapshot de macros al momento de registrar — independiente de que "Food"
  // se corrija después (mismo principio que SetLog: la historia no cambia
  // retroactivamente si el catálogo se actualiza).
  caloriesKcal Float
  proteinG     Float
  carbsG       Float
  fatG         Float

  meal Meal @relation(fields: [mealId], references: [id], onDelete: Cascade)
  food Food @relation(fields: [foodId], references: [id])

  @@index([mealId])
  @@index([foodId])
}

model BarcodeScan {
  id        String   @id @default(uuid())
  userId    String
  code      String
  foodId    String?  // null si el código no se encontró en ninguna fuente
  found     Boolean
  scannedAt DateTime @default(now())

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  food Food? @relation(fields: [foodId], references: [id])

  @@index([userId])
  @@index([code])
}

model NutritionGoal {
  id                String   @id @default(uuid())
  userId            String   @unique // un objetivo activo por usuario (MVP simplificado, sin historial de versiones)
  dailyCaloriesKcal Float
  proteinG          Float?
  carbsG            Float?
  fatG              Float?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DailyNutritionSummary {
  id                String   @id @default(uuid())
  userId            String
  date              DateTime @db.Date
  totalCaloriesKcal Float
  totalProteinG     Float
  totalCarbsG       Float
  totalFatG         Float
  mealCount         Int
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
}
```

**Relaciones en `User`**: `foods` no aplica (catálogo global, como `Exercise`), pero sí `meals`, `barcodeScans`, `nutritionGoal` (singular, por el `@unique`), `dailyNutritionSummaries` — mismo patrón de `onDelete: Cascade` en las 4.

**Nota de diseño importante sobre `DailyNutritionSummary`**: se propone tal como se pidió, pero **la recomendación de este plan es no construirla en el MVP** (ver sección 10) — `EvolutionService` demuestra que agregaciones diarias/semanales se pueden calcular en memoria al vuelo sin tabla materializada, a los volúmenes de datos de un MVP. Mantener la tabla en el diseño documentado por si el volumen real de uso lo justifica más adelante, pero no migrarla hasta tener evidencia de que la agregación en vivo es realmente un cuello de botella.

---

# 6. Endpoints REST

Todos bajo `@UseGuards(JwtAuthGuard)`, filtrados por `userId`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/nutrition/foods/search?q=` | Busca alimentos en el catálogo local por nombre |
| `GET` | `/nutrition/foods/:id` | Detalle de un alimento |
| `POST` | `/nutrition/foods` | Crea un alimento personalizado (registro manual sin coincidencia) |
| `POST` | `/nutrition/barcode/scan` | Busca por código; caché local → fuente externa → persiste si se encuentra; registra el intento en `BarcodeScan` |
| `POST` | `/nutrition/vision/analyze` | Envía una foto al proveedor de IA; devuelve candidatos **sin persistir nada** |
| `GET` | `/nutrition/meals?date=` | Lista las comidas de un día (default: hoy) |
| `POST` | `/nutrition/meals` | Crea una comida con sus ítems (registro manual, confirmación de escaneo o confirmación de análisis por foto — mismo endpoint para los 3 orígenes) |
| `GET` | `/nutrition/meals/:id` | Detalle de una comida |
| `DELETE` | `/nutrition/meals/:id` | Elimina una comida (y sus `MealItem` en cascada) |
| `GET` | `/nutrition/goals` | Objetivo nutricional activo del usuario |
| `PUT` | `/nutrition/goals` | Crea o actualiza el objetivo (upsert, dado el `@unique` en `userId`) |
| `GET` | `/nutrition/summary?date=` | Resumen del día (calculado en vivo, ver nota de la sección 5) |
| `GET` | `/nutrition/summary/history?days=7` | Tendencia de los últimos N días (para el gráfico, mismo patrón que Evolución) |

13 endpoints. Sin `PATCH` de edición parcial de una comida — para corregir un registro, la filosofía es borrar y volver a crear (mismo patrón ya usado en Composición Corporal), evita lógica de edición compleja en el MVP.

---

# 7. Mobile — pantallas

| Pantalla | Contenido | Componentes reutilizados |
|---|---|---|
| **Diario nutricional** | Vista del día actual: comidas agrupadas por tipo (desayuno/comida/cena/snack), totales corriendo de calorías/macros, CTA para añadir comida (manual/código/foto) | `Card`, `PrimaryButton` |
| **Escáner de código de barras** | Cámara con overlay de escaneo (`expo-camera` con detección de barcode), estado de "buscando...", resultado con macros del producto encontrado o mensaje "no encontrado" + fallback a búsqueda manual (igual que el Figma) | Patrón nuevo (cámara), sin precedente directo en el proyecto |
| **Cámara IA** | Captura o selección de foto, preview, estado "analizando...", lista de alimentos candidatos detectados (editable: nombre, gramaje, macros por ítem), confirmar para guardar como comida | `TextField` para edición, `PrimaryButton` |
| **Historial de comidas** | Lista/calendario de días anteriores, navegable, cada día resume el total y permite entrar al detalle | Mismo patrón de lista que `evolucion/cuerpo.tsx` |
| **Objetivos** | Formulario de calorías diarias + macros objetivo (todos opcionales salvo calorías) | `TextField`, `PrimaryButton` — mismo patrón que `cuerpo-agregar.tsx` |
| **Resumen diario** | Dashboard visual: barra/anillo de progreso de calorías vs. objetivo, desglose de macros, tendencia de los últimos 7 días (`LineChart` reutilizado) | `Card`, `LineChart` |

Reemplazan el `PlaceholderScreen` actual de `nutricion.tsx` — no se tocará en esta tarea (documento de diseño, no implementación).

---

# 8. Offline — diseño (no implementado)

El propio Figma contempla esto explícitamente (pantalla "Sincronización detectada: Conflicto de versión — Conservar local / Descargar la nube"), así que se diseña aquí aunque se recomienda **no construirlo en el MVP** (ver sección 10).

**Almacenamiento local**: `AsyncStorage` (ya usado indirectamente vía `expo-secure-store` en el proyecto) no es adecuado para datos relacionales — se propone `expo-sqlite` como espejo local de `Meal`/`MealItem`/una tabla de cola de sincronización (`SyncQueue`: acción, entidad, payload, timestamp, estado).

**Sincronización**: modelo de cola — cada acción offline (crear/borrar una comida) se guarda localmente con un UUID generado en el cliente y se encola. Al recuperar conexión, la cola se reproduce contra la API en orden. Los `POST /nutrition/meals` deben ser **idempotentes** (aceptar el UUID generado por el cliente como parte del payload, para que reintentar una misma creación no duplique la comida) — esto es un cambio necesario al diseño de la sección 6 si se implementa offline (el endpoint tendría que aceptar un `clientId` opcional).

**Resolución de conflictos**: dado que `Meal` es mayormente un log aditivo (no un recurso mutable compartido entre dispositivos), los conflictos reales son raros — ocurren solo si el mismo registro se edita/borra desde dos dispositivos antes de sincronizar. Para esos casos, replicar el patrón del Figma: detectar la discrepancia (comparar `updatedAt` remoto vs. local) y presentar la elección explícita al usuario ("Conservar local" / "Descargar la nube"), nunca resolver automáticamente en silencio.

**Por qué no en el MVP**: es la pieza de arquitectura más compleja y sin precedente en todo el proyecto — ningún otro módulo de GymIA maneja estado offline hoy. Construirla junto con el resto de Nutrición en las primeras 4 semanas multiplicaría el riesgo de la entrega completa. Mejor: lanzar Nutrición online-only, medir si los usuarios reales lo piden (uso en gimnasios con mala señal, por ejemplo), y construirlo como una iteración dedicada con su propio ciclo de diseño/QA.

---

# 9. Costes — estimación por escala

Supuesto: promedio de 2 análisis de foto/usuario/día (el caso de uso más caro), 30 días/mes. Escaneo de código de barras se asume gratis (Open Food Facts + USDA) salvo que la prueba empírica de la sección 3 obligue a un proveedor de pago.

| Escala | Análisis de foto/mes | Claude Haiku 4.5 (~$0.002–0.005/foto) | GPT-4o mini (~$0.0004/foto) | Storage de fotos (si se guardan) |
|---|---|---|---|---|
| **100 usuarios** | 6,000 | $12 – $30/mes | ~$2.4/mes | Unos pocos dólares/mes |
| **1,000 usuarios** | 60,000 | $120 – $300/mes | ~$24/mes | Del orden de $10-30/mes |
| **10,000 usuarios** | 600,000 | $1,200 – $3,000/mes | ~$240/mes | Del orden de $100-300/mes |

**Notas importantes:**
- Estas cifras son de orden de magnitud a partir de precios públicos encontrados en esta sesión — **no son una cotización**. Confirmar en la documentación oficial de cada proveedor antes de presupuestar en firme.
- La diferencia entre Claude Haiku y GPT-4o mini es significativa a escala (5×) — justifica un bake-off de precisión/calidad antes de decidir, no asumir que el proveedor más caro es automáticamente mejor.
- No incluye el costo de un eventual proveedor de pago para códigos de barra (si la prueba empírica de cobertura LATAM obliga a usar FatSecret Premier o similar) — desconocido hasta tener esa cotización.
- El costo de base de datos/backend no crece de forma relevante con estas 6 tablas nuevas a estas escalas — Postgres maneja este volumen sin cambios de infraestructura.

---

# 10. MVP de Nutrición

## Entra en el MVP

- Catálogo de alimentos (`Food`) + búsqueda por nombre.
- Registro manual de comidas (`Meal` + `MealItem`).
- Escaneo de código de barras contra Open Food Facts + USDA (gratis), con fallback a búsqueda/registro manual si no se encuentra.
- Reconocimiento por foto con **un solo proveedor** (recomendación: Claude Haiku 4.5, ver sección 12), con confirmación/edición obligatoria antes de guardar — sin cascada a un modelo más caro todavía.
- Objetivos nutricionales (un objetivo activo por usuario).
- Resumen diario, **calculado en vivo** (sin la tabla `DailyNutritionSummary` materializada).
- Las 6 pantallas mobile de la sección 7.

## Se pospone explícitamente

- **`DailyNutritionSummary` como tabla física** — construir solo si la agregación en vivo demuestra ser un cuello de botella real.
- **Detección robusta de múltiples alimentos en una sola foto** — el prompt lo intentará, pero no se invertirá en mejorar precisión más allá del comportamiento por defecto del modelo en el MVP; es la parte más propensa a error y la que más debe depender de la edición manual del usuario.
- **Cascada de proveedores** (Haiku → Sonnet en baja confianza) — un solo proveedor en el MVP, evaluar la cascada solo si la tasa de error del proveedor único resulta ser un problema real de producto.
- **Sincronización offline** — diseñada en la sección 8, no construida.
- **Recetas guardadas** (`SavedRecipe`/`RecipeIngredient` del boceto original de `PHASE3_SPIKE.md`).
- **"Nutria IA" generando dietas completas basadas en el historial de entrenamiento** — correlación con Entrenar, requiere su propio spike de prompt-engineering.
- **Integración con Evolución** (macros como señal de `progressScore`) — oportunidad futura, no en este alcance.

---

# 11. Roadmap

**Semana 5 — Backend: catálogo y registro manual**
- Migración Prisma: `Food`, `Meal`, `MealItem`, `BarcodeScan`, `NutritionGoal`, `DailyNutritionSummary` (schema completo aunque la tabla de resumen no se use activamente todavía).
- Módulo `nutrition/`: búsqueda de alimentos, CRUD de comidas manual, objetivos, resumen calculado en vivo.
- Tests unitarios del cálculo de resumen diario (mismo rigor aplicado a `EvolutionService`).

**Semana 6 — Backend: integraciones externas**
- Integración con Open Food Facts + USDA FoodData Central (`FoodSourceService`), caché en `Food`.
- Prueba empírica de cobertura LATAM (sección 3) — ejecutar antes de cerrar esta semana, puede cambiar la fuente primaria recomendada.
- Integración con el proveedor de visión elegido (`VisionService`), endpoint `POST /nutrition/vision/analyze`.
- Verificación en vivo de los 13 endpoints (mismo patrón de auditoría que Entrenar/Evolución/Composición Corporal).

**Semana 7 — Mobile: registro y consulta**
- Reemplazar el placeholder de `nutricion.tsx`.
- Pantallas: Diario nutricional, Historial, Objetivos, Resumen diario.
- Flujo de registro manual + búsqueda de alimentos conectado al backend.

**Semana 8 — Mobile: escaneo e IA + cierre**
- Pantallas: Escáner de código de barras, Cámara IA.
- Verificación end-to-end completa (los 3 orígenes de registro: manual, código, foto).
- `docs/NUTRITION_MVP_STATUS.md` (mismo formato que `EVOLUTION_MVP_STATUS.md`).
- Decisión informada sobre si `DailyNutritionSummary` necesita materializarse, con datos reales de uso de las 4 semanas.

---

# 12. Recomendación final

**Arquitectura recomendada para GymIA:**

1. **Proveedor de visión: Claude Haiku 4.5** como elección inicial — costo bajo, salida JSON estructurada confiable, coherente con el resto del proyecto. **Pero no sin antes correr un bake-off de precisión real contra GPT-4o mini** (5× más barato según esta investigación) con ~20-30 fotos de comida reales antes de comprometerse — la decisión de costo por sí sola no debe primar sobre la precisión de reconocimiento, que es lo que determina si el producto es útil.
2. **Fuentes de alimentos: Open Food Facts (primaria) + USDA FoodData Central (secundaria)**, ambas gratuitas — **condicionado a la prueba empírica de cobertura LATAM** de la sección 3, que debe ejecutarse en la Semana 6 antes de cerrar esta decisión en firme. Evitar FatSecret/Nutritionix/Edamam de pago hasta tener evidencia de que las opciones gratuitas no alcanzan.
3. **Revisión legal de la licencia ODbL de Open Food Facts** antes de escribir cualquier código que combine sus datos con contribuciones propias de usuarios — no es un bloqueante técnico pero sí uno de proceso.
4. **Esquema de 6 tablas tal como se diseñó**, con la única salvedad de **no materializar `DailyNutritionSummary` en el MVP** — calcular en vivo, mismo patrón ya validado en `EvolutionService`, y decidir con datos reales de las primeras 4 semanas si compensa el costo de mantenerla sincronizada.
5. **Un solo proveedor de IA en el MVP, sin cascada** — mantener la superficie de riesgo pequeña; añadir cascada a un modelo más preciso (Sonnet 5) solo si la tasa de error del modelo económico resulta ser un problema real medido con usuarios.
6. **Offline sync explícitamente fuera del MVP** — diseño documentado en la sección 8 para cuando haya evidencia real de que los usuarios lo necesitan, no antes.
7. **4 semanas (5-8), backend primero, mobile después** — mismo orden que ya funcionó para Entrenar/Evolución/Composición Corporal.

---

## Sources

- [Claude Pricing 2026 — Coursiv](https://coursiv.io/blog/claude-pricing-2026)
- [Anthropic API Pricing 2026 — Finout](https://www.finout.io/blog/anthropic-api-pricing)
- [Open Food Facts — Terms of use](https://world.openfoodfacts.org/terms-of-use)
- [Open Food Facts — Discover](https://world.openfoodfacts.org/discover)
- [USDA FDC API Guide — Rate Limits](https://calorieapi.com/blog/usda-fooddata-central-api-guide)
- [Nutritionix API pricing](https://selfhostednutrition.org/api/nutritionix-api-when-to-use/)
- [FatSecret Platform API](https://platform.fatsecret.com/platform-api)
- [FatSecret Premium Pricing 2026](https://nutriscan.app/blog/posts/fatsecret-premium-pricing-2026-monthly-yearly-eb76d29acc)
- [Food and Grocery Database API — Edamam](https://developer.edamam.com/food-database-api)
- [The Complete Guide to Barcode Lookup APIs in 2026 — ChowAPI](https://chowapi.dev/blog/complete-guide-barcode-lookup-apis-2026)
- [GPT-4o Pricing 2026 — PE Collective](https://pecollective.com/tools/gpt-4o-pricing/)
- [GPT-4o mini Pricing — PE Collective](https://pecollective.com/tools/gpt-4o-mini-pricing/)
- [What vision costs: token pricing for images — The Neural Base](https://theneuralbase.com/openai/learn/intermediate/what-vision-costs-token-pricing-for-images/)
- [Gemini API Pricing — Cloudzero](https://www.cloudzero.com/blog/gemini-pricing/)
- [Azure AI Services Pricing Details](https://www.azure.cn/en-us/pricing/details/cognitive-services/)
- [Demystifying Azure AI Vision Pricing](https://www.oreateai.com/blog/demystifying-azure-ai-vision-pricing-what-you-need-to-know/373d1cb8487de57c5864733b89f4d7b8)
