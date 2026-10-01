# Recalculación del Roadmap — Post-Achievements

**Fecha:** 2026-09-25
**Contexto:** S4-ProgressAchievements quedó aceptado con solo 2 de sus 4 secciones implementadas (PRs + Compartir), tras confirmar que Adherencia e Insignias son gaps reales, no funcionalidad simplificable. Esta recalculación compara los 3 bloques restantes (Evolución, Sueño avanzado, Nutrición) con ese mismo criterio: **paridad real verificable, sin inventar funcionalidad ni abrir proyectos de infraestructura mayores.**

**Lección aplicada de Achievements:** la estimación previa de esa pantalla (~78% de fidelidad, `docs/FINAL_PARITY_PRIORITY.md`) resultó ser casi el doble de la fidelidad real una vez verificado el diseño (~45%) — las estimaciones de "vía honesta simplificada" hechas sin traer el diseño real tienden a ser optimistas. Se aplica ese descuento de confianza a Evolución y Nutrición abajo, ninguna de las cuales se ha verificado en Figma todavía para este documento.

---

## Comparación

| Bloque | Incremento esperado | Complejidad | Dependencias | Riesgo |
|---|---|---|---|---|
| **Sueño avanzado (Fuentes y Diagnóstico)** | **~0.75 pts** — real, no estimado a la baja: es una sola pantalla que muestra el estado verdadero del sistema (1 fuente conectada, 0 conflictos), no una simplificación | 🟢 Baja — reutiliza `SleepDataSource`/`sleepApi.ts` ya construidos, cero UI ni lógica nueva de fondo | Ninguna | 🟢 Bajo — no hay nada que inventar, es un reflejo directo de datos reales |
| Sueño avanzado (+ Preparar Descanso, opcional) | +~0.45 pts adicionales (parcial) | 🟡 Media | `expo-notifications` (ya instalado) | 🟡 Medio — el checklist puede insinuar más inteligencia de la real si el copy no se cuida |
| Evolución restante (5 pantallas, shell honesto) | ~2.6 pts **estimado sin verificar diseño real** — mayor riesgo de sobreestimación tras la lección de Achievements | 🟢 Baja si se mantiene como shell puro | Ninguna | 🟡 Medio-alto — son 5 pantallas que documentan ausencia de funcionalidad, no funcionalidad real; es exactamente el patrón que acabas de pedir evitar si se ejecuta sin disciplina |
| Nutrición restante (6 pantallas, shell honesto) | ~1.7 pts **estimado sin verificar diseño real** | 🟡 Media | Ninguna | 🔴 Alto — ninguna de las 6 tiene ningún dato real detrás (a diferencia de Evolución, donde el registro manual sí existe); es el bloque con más riesgo de sentirse relleno de los tres |

---

## Recomendación única

**Sueño avanzado — específicamente Fuentes y Diagnóstico.**

Es el único de los tres bloques donde el incremento de paridad proviene de **funcionalidad real**, no de documentar ausencias. Evolución y Nutrición, incluso en su vía más barata ("shell honesto"), sacan su ganancia de páginas informativas que explican qué falta — exactamente el tipo de resultado que acabas de pedir evitar tras la experiencia con las insignias de Achievements. Fuentes y Diagnóstico, en cambio, es una pantalla que hace lo que dice: muestra el estado verdadero de las fuentes de sueño conectadas, sin fabricar nada.

Es un bloque pequeño (~0.75 pts, una sola pantalla) — si se quiere una ganancia mayor de una sola vez, la alternativa honesta es Evolución (shell), pero con la advertencia explícita de que su estimación (~2.6 pts) no está verificada contra el diseño real todavía, y que tras la sorpresa de Achievements conviene tratarla como un techo optimista, no como un número confiable hasta traer las 5 pantallas de Figma y repetir el mismo ejercicio de verificación que se hizo aquí.

**Nutrición queda última en cualquier escenario** — mismo tipo de ganancia que Evolución (shell, sin funcionalidad real detrás) pero con mayor riesgo, porque a diferencia de Evolución no hay ningún dato real parcial que respalde ni una sola de sus 6 pantallas.

**Fuera del alcance de esta comparación, pero relevante:** las 3 fuentes del gap de Adherencia (Evolución, Perfil de Miembro de Escuadrón, Hub de Escuadrón) y ahora una 4ª (Achievements) apuntan a que construir un motor de adherencia real — no una pantalla suelta, sino la capacidad de fondo — desbloquearía valor verificable en varios módulos a la vez. No se incluye en la recomendación porque el usuario pidió elegir solo entre los 3 bloques dados, pero queda como la opción de mayor apalancamiento si en algún momento se quiere abrir ese proyecto de infraestructura de forma deliberada (no como parche de una pantalla).

Sin código, sin commits — a la espera de la decisión.
