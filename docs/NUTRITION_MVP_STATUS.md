# Nutrición MVP — Estado Final (Semana 6, Mobile)

**Fecha:** 2026-09-24
**Alcance:** mobile completo sobre el backend ya verificado (`docs/NUTRITION_IMPLEMENTATION_STATUS.md`), siguiendo estrictamente `docs/NUTRITION_MVP_ROADMAP.md` y `docs/NUTRITION_TECHNICAL_PLAN.md`. Sin IA por foto, sin código de barras, sin offline sync, sin recomendaciones IA — según lo pedido en las 3 semanas de esta fase.

---

## 1. Funcionalidades implementadas

- **Registro manual de alimentos**: catálogo propio por usuario, con búsqueda por nombre y creación inline de alimentos nuevos.
- **Registro de comidas**: selector de tipo (desayuno/comida/cena/snack), cantidad en gramos, cálculo automático de macros según `servingSizeG`.
- **Reutilización inteligente de comidas**: si ya existe una comida del mismo tipo registrada hoy, el nuevo alimento se agrega ahí en vez de crear una comida fragmentada — decisión de diseño tomada durante esta implementación (no estaba especificada en los docs base), documentada en la sección 6.
- **Diario nutricional**: comidas de hoy agrupadas, total de calorías del día, eliminar un ítem individual.
- **Resumen diario**: calorías y macros consumidos, barras de progreso contra el objetivo.
- **Objetivo nutricional**: crear/editar calorías diarias + macros opcionales — integrado dentro de la pantalla de Resumen (ver sección 6, no existía como pantalla separada en el pedido de esta tarea).
- **Historial de comidas**: agrupado por día, todos los días con registros.

## 2. Archivos creados

**Mobile**
- `src/app/(app)/nutricion/_layout.tsx` — Stack de la pestaña Nutrición
- `src/app/(app)/nutricion/index.tsx` — Diario Nutricional (M1, reemplaza el `PlaceholderScreen`)
- `src/app/(app)/nutricion/agregar.tsx` — Registro manual (M2)
- `src/app/(app)/nutricion/resumen.tsx` — Resumen Diario + Objetivo (M5)
- `src/app/(app)/nutricion/historial.tsx` — Historial de Comidas (M3)
- `src/lib/nutritionApi.ts` — cliente API (M4/M6): 13 funciones cubriendo Foods, Meals, Nutrition Goals y Summary

**Backend**
- `src/nutrition/nutrition.service.ts` (modificado) — redondeo de macros en `getTodaySummary` (ítem 7 de esta tarea)

## 3. Pantallas implementadas

| Pantalla | Ruta | Contenido |
|---|---|---|
| Diario Nutricional | `/nutricion` | Total de hoy, comidas agrupadas con sus ítems, botón quitar ítem, CTA agregar alimento, enlaces a Resumen/Historial |
| Registrar Comida | `/nutricion/agregar` | Selector de tipo de comida, búsqueda/creación de alimento, cantidad, guardar |
| Resumen Diario | `/nutricion/resumen` | Calorías y macros vs. objetivo con barras de progreso, formulario de objetivo inline |
| Historial de Comidas | `/nutricion/historial` | Comidas agrupadas por día, con total de calorías por día |

## 4. Endpoints consumidos

Los 14 endpoints del backend (`docs/NUTRITION_IMPLEMENTATION_STATUS.md`), con estas excepciones deliberadas de alcance:
- `PATCH /foods/:id`, `DELETE /foods/:id`, `DELETE /meals/:id` **no tienen UI** en este MVP — el cliente API los expone (`nutritionApi.ts` los implementa donde aplica) pero ninguna pantalla los usa. No estaban en la lista de pantallas pedida (M1-M5); se dejan como funciones disponibles para una siguiente iteración.

## 5. Corrección de deuda pendiente (ítem 7)

`getTodaySummary` ahora redondea `totalCaloriesKcal`/`totalProteinG`/`totalCarbsG`/`totalFatG` a 1 decimal (`Math.round(x * 10) / 10`), mismo patrón que `EvolutionService`. Elimina el artefacto de punto flotante (`5.6000000000000005`) documentado como hallazgo menor en la verificación de Semana 5. Verificado en vivo: el Resumen Diario ahora muestra `248 kcal` limpio, sin decimales espurios.

## 6. Decisiones de diseño tomadas durante la implementación

1. **Estructura de rutas — corregida durante la verificación en navegador.** Las 4 pantallas se crearon inicialmente como archivos planos directamente en `(app)/` (`nutricion-agregar.tsx`, etc.), siguiendo el patrón de nombres de Composición Corporal. Al probar en el navegador, Expo Router las agregó como **pestañas nuevas** en el tab bar (porque vivían al mismo nivel que los archivos de las pestañas reales, no dentro de una subcarpeta con su propio Stack como sí ocurre con `evolucion/cuerpo-*.tsx`). Corregido moviendo todo a `(app)/nutricion/` con su propio `_layout.tsx` (Stack) — mismo patrón exacto que `evolucion/` y `entrenar/`. Verificado que el tab bar vuelve a mostrar solo 4 pestañas.
2. **Reutilización de comida por tipo y día**: al registrar un alimento, si ya existe una comida del mismo `mealType` registrada hoy, el nuevo ítem se agrega a esa comida (vía `GET /meals` + filtro cliente) en vez de crear una comida nueva cada vez. Evita que el diario se fragmente en muchas comidas de un solo ítem. No estaba especificado en los docs base; es una decisión de UX razonable dado el diseño del backend (crear comida y agregar ítems son pasos separados).
3. **Sin pantalla dedicada de "Objetivos"**: el pedido de esta tarea (a diferencia de `NUTRITION_MVP_ROADMAP.md`, que sí tenía una pantalla M4 "Objetivos" separada) no la incluyó en la lista de 6 pasos. Como "Resumen Diario — Progreso vs objetivo" no tiene sentido sin forma de fijar un objetivo, se integró un formulario inline en la propia pantalla de Resumen (mostrar/editar), evitando añadir una pantalla no pedida.

## 7. Validación

```
$ npx tsc --noEmit
(sin errores)

$ npm run lint   (mobile)
✖ 2 problems (0 errors, 2 warnings)   — ambos preexistentes, sin relación (useStorageState.ts)

$ npm run build / test / lint   (backend, tras el fix de redondeo)
build: sin errores · test: 57/57 · lint: sin errores
```

## 8. Prueba funcional completa — resultado

Ejecutada en navegador (Metro web) contra el backend real, con un usuario de prueba desechable (eliminado al terminar, 0 residuos en las 5 tablas relevantes):

| Paso | Resultado |
|---|---|
| Diario vacío (usuario nuevo) | Estado vacío correcto, "0 kcal" |
| Crear alimento nuevo (Pechuga de pollo) desde Registrar Comida | Alimento creado, formulario avanza automáticamente a "Cantidad" |
| Guardar comida (150g) | `POST /meals` (201) + `POST /meals/:id/items` (201) — confirmado por red |
| Ver Diario | "Total de hoy: 247.5 kcal", comida "Comida" a las 08:35 con "Pechuga de pollo, 150g · 248 kcal" |
| Ver Resumen | "248 kcal", "Proteína 47g", "Carbohidratos 0g", "Grasa 5g" — sin decimales espurios |
| Establecer objetivo (2000 kcal, 150g proteína) | Guardado correctamente; Resumen ahora muestra "248 / 2000 kcal" con barra de progreso y "47g / 150g" en proteína |
| Ver Historial | Día agrupado correctamente, "248 kcal", lista de comidas con sus alimentos |
| Quitar el ítem del Diario | `DELETE /meals/:id/items/:itemId` — total vuelve a "0 kcal", comida queda vacía (sin auto-eliminarse, comportamiento esperado) |
| Buscar alimento ya creado ("pechuga") | Filtro case-insensitive funciona correctamente |

**Un hallazgo durante la prueba no fue un bug**: al reutilizar una sesión del navegador de una prueba anterior (Composición Corporal), un `POST /foods` devolvió `500` por violación de FK — la sesión pertenecía a un usuario ya eliminado de la base de datos en una tarea previa. Se resolvió cerrando sesión y registrando un usuario nuevo; no requirió ningún cambio de código.

**Conclusión: el flujo completo (crear alimento → registrar comida → ver diario → ver resumen diario) queda validado end-to-end en mobile**, incluyendo historial y objetivo.

## 9. Porcentaje completado de Nutrición MVP

**100%** del alcance definido para este MVP (backend Semana 5 + mobile Semana 6), ambos verificados end-to-end en vivo. Quedan fuera, deliberadamente, del MVP: IA por fotografía, código de barras, offline sync, recomendaciones IA, y las 3 acciones de UI no conectadas (editar/borrar alimento, borrar comida completa) — todas documentadas como alcance futuro, no como pendientes olvidados.

## 10. Siguiente paso

Fuera del alcance de esta tarea (no se ejecuta aquí, según lo pedido — "no hacer commit todavía"):
- Commit y push de los cambios de mobile y del fix de backend.
- Decisión de producto sobre la siguiente fase: conectar `PATCH`/`DELETE` de alimentos y `DELETE` de comida a la UI, o avanzar hacia IA/código de barras según el roadmap original de 8 semanas de `PHASE3_SPIKE.md`.
