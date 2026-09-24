# Nutrición — Spike Técnico

**Fecha:** 2026-09-24
**Tipo de documento:** investigación y diseño técnico. **No incluye código ni implementación** — solo análisis para poder planificar Fase 4 con datos reales de costo/arquitectura, según lo definido como paso previo en `docs/PHASE3_SPIKE.md` (Semana 3-4).
**Fuente de evidencia de producto:** Figma "Final-Pro" (`fileKey=O4cXfRJ7qCbKuH3Jdon00k`), nodos `Gymia-Nutrition-Ecosystem-Board` (`115:4430`), `Nutrition-IA` (`142:5990`) y pantallas relacionadas — ya explorados en `docs/PHASE3_SPIKE.md`.
**Fuente de precios/capacidades:** búsquedas web realizadas en esta sesión (septiembre 2026), citadas al final de cada sección relevante. Los precios son orientativos al momento de escribir este documento — deben re-confirmarse contra la documentación oficial de cada proveedor antes de comprometer presupuesto.

---

## 1. Arquitectura propuesta

Nutrición requiere dos piezas de infraestructura que **no existen hoy** en el proyecto: (a) un proveedor de IA de visión para reconocer alimentos en foto, y (b) una fuente de datos de alimentos (con y sin código de barras). Arquitectura propuesta, siguiendo el mismo patrón modular ya usado en Entrenar/Evolución/Composición Corporal:

```
Mobile (Expo)
  │
  ├─ POST /nutrition/meals/scan-photo  (multipart: foto)
  │     └─ NestJS → Proveedor de visión IA → normaliza respuesta → responde candidatos
  │
  ├─ POST /nutrition/meals/scan-barcode  (body: código)
  │     └─ NestJS → caché local (Postgres) → si no existe, consulta fuente externa → guarda en caché
  │
  ├─ POST /nutrition/meals  (registro manual o confirmado tras escaneo)
  │     └─ NestJS → Prisma → Postgres (mismo patrón que BodyMetric/SetLog)
  │
  └─ GET /nutrition/summary
        └─ NestJS → Prisma → agregación en memoria (mismo patrón que EvolutionService)
```

**Decisión clave de arquitectura: caché-primero, no proxy puro.** A diferencia de Composición Corporal (donde el backend nunca toca los bytes de la foto), aquí el backend **sí** necesita ver la foto para enviarla al proveedor de IA, y **sí** necesita persistir localmente los resultados de alimentos (propios y de fuentes externas) en una tabla `FoodItem` — igual que el catálogo `Exercise` ya existente — para no pagar dos veces por el mismo alimento y para poder operar (parcialmente) sin conexión a proveedores externos si fallan.

Esto reutiliza exactamente el diseño ya propuesto en `PHASE3_SPIKE.md` sección 6 (`FoodItem`, `MealLog`, `MealLogEntry`, `SavedRecipe`, `RecipeIngredient`), con un ajuste: `FoodItem.source` debe distinguir entre `'usda'`, `'openfoodfacts'`, `'vision_ai'`, `'manual'` para poder auditar de dónde vino cada dato y aplicar la licencia correcta a cada fuente (ver sección 5).

## 2. Integración IA de visión

El Figma (`Análisis Vision+`, nodo dentro de `Gymia-Nutrition-Ecosystem-Board`) muestra un flujo de reconocimiento de plato con nivel de confianza explícito ("¿No corresponde? Repetir Foto / Editar macros") — es decir, el diseño **ya asume que el modelo se equivoca a veces** y construye la UI alrededor de esa realidad, no la esconde. Esto es la decisión de producto correcta y debe guiar la integración técnica: nunca auto-guardar sin confirmación del usuario.

**Opciones de proveedor evaluadas** (sin contratar ninguna todavía):

| Proveedor | Modelo | Precio de referencia (input/output por 1M tokens) |
|---|---|---|
| Anthropic (Claude) | Haiku 4.5 / Sonnet 5 | Haiku 4.5: $1 / $5 · Sonnet 5: $2 / $10 |
| Anthropic (Claude) | Opus 5.5 (mayor precisión, mayor costo) | $4 / $20 |

Una foto de plato a resolución típica de cámara de teléfono (redimensionada a ~1024px antes de enviar, buena práctica estándar) consume aproximadamente 1,000–1,600 tokens de entrada según la fórmula de tokenización de imágenes de Anthropic (`(ancho × alto) / 750`), más unos cientos de tokens de salida para una respuesta estructurada (nombre del plato + lista de ingredientes + macros estimados). Con Haiku 4.5, esto implica un costo de **fracciones de centavo de dólar por foto analizada** (del orden de $0.002–$0.005 por análisis) — el modelo económico es viable incluso a escala de miles de análisis diarios. Sonnet 5 costaría roughly 2-4× eso, y se reservaría para casos donde Haiku reporte baja confianza (estrategia de cascada, ver MVP).

No se evaluaron proveedores de visión especializados no conversacionales (ej. Google Cloud Vision, servicios de "food recognition" dedicados) en esta pasada — es el siguiente paso de este mismo spike si se decide no usar un modelo conversacional general.

*Fuentes: [Claude Pricing 2026 — Full Breakdown](https://coursiv.io/blog/claude-pricing-2026), [Anthropic API Pricing 2026 — Complete Guide](https://www.finout.io/blog/anthropic-api-pricing).*

## 3. Reconocimiento por foto — diseño del flujo

1. Mobile comprime/redimensiona la foto (~1024px, formato JPEG) antes de subir — reduce costo de tokens y tiempo de subida.
2. `POST /nutrition/meals/scan-photo` recibe la foto (multipart — a diferencia de Composición Corporal, aquí el backend sí necesita procesar el archivo, no solo almacenarlo, así que el patrón de "signed URL directo a Storage" de `ProgressPhoto` no aplica igual: se necesitaría subir primero a Storage y luego pasar la URL/bytes al proveedor de IA, o enviar el archivo directo desde el backend).
3. El backend construye un prompt estructurado (pidiendo salida en JSON: nombre del alimento, lista de ingredientes candidatos, gramaje estimado, macros, y un campo de confianza) y llama al proveedor.
4. La respuesta **nunca se guarda directamente** como `MealLog` — se devuelve al cliente como propuesta editable (coincide exactamente con el botón "Editar macros" visto en el Figma).
5. Solo al confirmar el usuario, se llama a `POST /nutrition/meals` con los valores (editados o no).

**Riesgo de diseño explícito:** un modelo de lenguaje con visión no es un clasificador de alimentos entrenado específicamente — puede alucinar ingredientes o gramajes con alta confianza aparente. El Figma ya contempla esto con el flujo de "¿No corresponde?", que debe implementarse literalmente, no simplificarse en el MVP.

## 4. Escaneo de códigos de barras

El Figma muestra un estado explícito de "Código No Encontrado" con fallback a búsqueda por nombre o registro manual — el diseño **ya asume cobertura incompleta**, coherente con la realidad de cualquier base de datos de códigos de barras (ninguna es 100% completa, especialmente para marcas locales/regionales fuera de EE.UU./Europa).

Flujo propuesto: escaneo con `expo-camera`/`expo-barcode-scanner` (o el escáner nativo integrado en `expo-camera` desde SDK 51+) → `POST /nutrition/meals/scan-barcode { code }` → el backend busca primero en `FoodItem` local (caché) → si no existe, consulta la fuente externa configurada → si tampoco existe ahí, responde "no encontrado" para que el cliente ofrezca los 3 fallbacks del Figma (buscar por nombre, crear alimento personalizado, registrar sin foto).

Opciones de fuente evaluadas: ver sección 5 (Open Food Facts cubre codigos de barra internacionales gratis; APIs comerciales como Edamam/ChowAPI ofrecen mejor cobertura de marca pero con costo por request).

## 5. Fuentes de datos de alimentos

| Fuente | Cobertura | Costo | Licencia / restricciones |
|---|---|---|---|
| **Open Food Facts** | Global, fuerte en Europa, colaborativa (crowdsourced) — cobertura desigual por país, especialmente débil en México/LatAm comparado con EE.UU./Europa | **100% gratis**, sin paywall ni límite de requests documentado | **ODbL (Open Database License) + DbCL** — cualquier base de datos que combine estos datos con datos propios debe, bajo "share-alike", liberarse también como datos abiertos. Esto es una restricción legal real si GymIA quiere mantener su catálogo de alimentos como propiedad cerrada — requiere revisión legal antes de usar, no es un simple "es gratis, listo". |
| **USDA FoodData Central** | Excelente para EE.UU. (300k+ alimentos), débil para productos empaquetados de otros países | Gratis con API key de data.gov | 1,000 requests/hora con key gratuita (30/hora con la demo key) — suficiente para un MVP, no para escala alta sin pedir aumento de cuota |
| **Nutritionix** | Fuerte en EE.UU., incluye NLP para texto libre ("dos huevos y pan tostado" → macros) | Free: 200 calls/día · Hobby: ~$50/mes (~10k calls/día) · Producción: $500–$2,000+/mes | Comercial, sin restricción de share-alike — más apto si se quiere mantener el catálogo propio cerrado |
| **Edamam Food Database** | 700k+ códigos UPC/EAN/ITN, incluye NLP e imagen | Free tier limitado + planes de pago por volumen (no confirmado el precio exacto en esta pasada) | Comercial |
| **ChowAPI / agregadores de barcode** | Cobertura variable, modelo pay-per-lookup | Desde $0.0005/llamada (paquete de 5,000 por $5) | Comercial, sin restricción de share-alike |

**Recomendación preliminar**: combinar **Open Food Facts** (gratis, buena cobertura internacional de códigos de barra) como fuente primaria de barcode, con **USDA FoodData Central** (gratis) como fuente secundaria para alimentos genéricos sin marca — evitando por ahora fuentes comerciales de pago hasta validar demanda real. La restricción ODbL de Open Food Facts debe evaluarse con criterio legal antes de decidir si se cachea/combina su data con contribuciones propias de usuarios de GymIA.

*Fuentes: [Open Food Facts — Terms of use](https://world.openfoodfacts.org/terms-of-use), [USDA FDC API Guide — Rate Limits](https://calorieapi.com/blog/usda-fooddata-central-api-guide), [Nutritionix API pricing](https://selfhostednutrition.org/api/nutritionix-api-when-to-use/), [ChowAPI barcode pricing](https://chowapi.dev/blog/complete-guide-barcode-lookup-apis-2026), [Edamam Food Database API](https://developer.edamam.com/food-database-api).*

## 6. Costos (estimados, a confirmar antes de comprometer presupuesto)

Escenario ilustrativo: 500 usuarios activos, cada uno registra ~2 comidas/día vía foto y ~1 vía código de barras (30 días/mes):

| Partida | Volumen mensual | Costo estimado/mes |
|---|---|---|
| IA de visión (Claude Haiku 4.5, foto → macros) | 500 × 2 × 30 = 30,000 análisis | ~$60–$150 (a ~$0.002–$0.005/análisis) |
| Escaneo de código de barras | 500 × 1 × 30 = 15,000 lookups | $0 si se usa Open Food Facts/USDA; con un proveedor comercial tipo ChowAPI, ~$7.50 (a $0.0005/llamada) |
| Almacenamiento de fotos de comida (si se decide guardar, no solo analizar) | ~30,000 imágenes/mes | Supabase Storage — mismo esquema de precio que `ProgressPhoto`, del orden de unos pocos dólares/mes a este volumen |
| **Total estimado** | | **~$60–$160/mes a 500 usuarios activos** (orden de magnitud, no cotización) |

Esta cifra escala linealmente con el volumen de análisis de fotos — es, con diferencia, la partida dominante del costo. Confirmar precios exactos y límites de rate directamente en la documentación de Anthropic antes de presupuestar en firme.

## 7. Riesgos

- **Alucinación del modelo de visión**: puede identificar mal un alimento o estimar gramajes incorrectos con confianza aparente alta. Mitigado por diseño (confirmación obligatoria del usuario, nunca auto-guardado), pero es un riesgo de producto permanente, no algo que se "arregle" una vez.
- **Licencia ODbL de Open Food Facts**: share-alike puede obligar a liberar datos combinados — requiere revisión legal antes de usar como fuente primaria, no es una decisión puramente técnica.
- **Cobertura desigual de bases de datos gratuitas fuera de EE.UU./Europa** — riesgo real para un producto que probablemente tenga usuarios en México/LatAm (mismo idioma del proyecto), donde tanto Open Food Facts como USDA tienen cobertura más débil.
- **Costo variable y difícil de predecir con precisión** sin datos reales de uso — el estimado de la sección 6 es de orden de magnitud, no una cotización; validar con un piloto pequeño antes de escalar.
- **Complejidad de UX ya es alta en el diseño de Figma** (7+ pantallas: dashboard, recetas, escáner de foto, escáner de código, ajustes, conflicto de sincronización) — mayor superficie de bugs y mantenimiento que cualquier módulo construido hasta ahora en GymIA.
- **Sincronización offline con resolución de conflictos** (pantalla "Conservar local / Descargar la nube" vista en Figma) es una pieza de arquitectura nueva y genuinamente compleja, sin precedente en el proyecto — explícitamente fuera de alcance de este spike y de cualquier MVP recortado (ver sección 8).
- **Dependencia de un proveedor externo de IA** para una funcionalidad core del producto — necesita manejo de fallos (timeout, rate limit, proveedor caído) con degradación elegante a registro manual, no un punto único de fallo.

## 8. MVP posible

Recortando deliberadamente lo más riesgoso/costoso (sincronización offline) y lo que requiere más superficie de UI (recetas, ajustes avanzados de macros con IA), un MVP viable sería:

1. **Registro manual** de comidas con búsqueda de alimentos (por nombre, contra la caché local `FoodItem` + fuentes gratuitas) — sin IA todavía.
2. **Escaneo de código de barras** contra Open Food Facts + USDA, con fallback a registro manual si no se encuentra — sin costo de IA, cobertura variable pero gratis.
3. **Reconocimiento por foto con Claude Haiku 4.5**, con confirmación obligatoria del usuario antes de guardar — es el único componente de IA de visión en el MVP, y el de mejor relación costo/valor diferencial frente a competidores.
4. **Resumen diario de calorías/macros** — reutiliza el patrón de agregación ya construido en `EvolutionService`.

**Explícitamente fuera del MVP** (quedan para iteraciones posteriores): recetas guardadas, ajustes de "Nutria IA" que generan dietas completas basadas en el historial de entrenamiento (visto en el nodo `Nutrition-IA` del Figma — es una feature de recomendación con su propio spike de prompt-engineering pendiente), y sincronización offline.

Este MVP mantiene el diferencial real (reconocimiento por foto) sin comprometerse con las piezas más costosas/riesgosas del diseño completo.

## 9. Roadmap

**Antes de implementar (obligatorio):**
- Revisión legal de la licencia ODbL de Open Food Facts en el contexto específico de GymIA.
- Confirmar precios y límites de rate actuales de Anthropic directamente en su documentación oficial (los de este documento son de una búsqueda puntual, no una cotización).
- Decidir explícitamente si las fotos de comida se almacenan (como `ProgressPhoto`) o solo se analizan y se descartan — tiene implicaciones de costo de Storage y de privacidad distintas.

**Implementación (una vez resueltos los puntos anteriores):**
1. Semana 1: `FoodItem`, `MealLog`, `MealLogEntry` (schema, migración, módulo backend) + registro manual + búsqueda contra caché local.
2. Semana 2: integración con Open Food Facts + USDA (backend), endpoint de escaneo de código de barras, mobile: pantalla de escáner + fallback a búsqueda manual.
3. Semana 3: integración con Claude Haiku 4.5 para reconocimiento por foto, con el flujo de confirmación/edición obligatoria; mobile: pantalla de captura + revisión.
4. Semana 4: resumen diario de calorías/macros (dashboard), auditoría end-to-end (mismo patrón que Entrenar/Evolución/Composición Corporal), documento de estado.

**Explícitamente diferido a una fase posterior** (no forma parte de este roadmap de 4 semanas): recetas guardadas, "Nutria IA" generando dietas completas, sincronización offline con resolución de conflictos.

---

## Sources

- [Claude Pricing 2026: Every Model, Every Tier, Full Breakdown — Coursiv](https://coursiv.io/blog/claude-pricing-2026)
- [Anthropic API Pricing in 2026: Complete Guide — Finout](https://www.finout.io/blog/anthropic-api-pricing)
- [Open Food Facts — Terms of use, contribution and re-use](https://world.openfoodfacts.org/terms-of-use)
- [Open Food Facts — Data, API and SDKs](https://world.openfoodfacts.org/data)
- [USDA FDC API: Demo Key, Rate Limits, Search — Calorie API](https://calorieapi.com/blog/usda-fooddata-central-api-guide)
- [Nutritionix API: when (if ever) does paying for it make sense? — Self-Hosted Nutrition](https://selfhostednutrition.org/api/nutritionix-api-when-to-use/)
- [Nutrition API by Nutritionix](https://www.nutritionix.com/api)
- [The Complete Guide to Barcode Lookup APIs in 2026 — ChowAPI](https://chowapi.dev/blog/complete-guide-barcode-lookup-apis-2026)
- [Food and Grocery Database API — Edamam](https://developer.edamam.com/food-database-api)
