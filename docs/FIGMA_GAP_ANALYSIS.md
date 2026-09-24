# GymIA-Mobile-App — Auditoría Visual contra Figma

**Fecha:** 2026-09-24, actualizado el mismo día tras **Sprint Figma Parte 1**.
**Alcance:** solo auditoría visual, sin cambios de backend. Figma fuente: "Final-Pro" (`fileKey=O4cXfRJ7qCbKuH3Jdon00k`).
**Metodología:** captura fresca de cada pantalla de Figma (nodo real, no memoria) comparada con captura en vivo de la app corriendo en Metro web, más el conocimiento ya validado de las auditorías de fidelidad ya realizadas en fases anteriores del proyecto para Evolución y Composición Corporal.

---

## Resumen ejecutivo (post Sprint Figma Parte 1)

| Pantalla/Estado | Similitud original | Similitud actual | Prioridad |
|---|---|---|---|
| Splash | 0% | **~68%** ✅ corregido | 🟢 Baja |
| Onboarding | 0% | 0% (fuera de alcance de esta parte) | 🟡 Media |
| Login | 88% | 88% (sin cambios) | 🟢 Baja |
| Registro | 82% | 82% (sin cambios) | 🟢 Baja |
| Recuperación de contraseña | 0% | **~78%** ✅ corregido | 🟢 Baja |
| Home / Evolución General | 92% | 92% (sin cambios) | 🟢 Baja |
| Entrenar | 80% | 80% (sin cambios, sin re-verificación) | 🟡 Media |
| Evolución (Fuerza) | 90% | 90% (sin cambios) | 🟢 Baja |
| Composición Corporal | 90% | 90% (sin cambios) | 🟢 Baja |
| Nutrición | 45% | 45% (sin cambios) | 🟡 Media |
| Perfil | 12% | **~50%** ✅ corregido | 🟡 Media |
| Estados vacíos (transversal) | 85% | 85% (sin cambios) | 🟢 Baja |
| Estados de error (transversal) | 65% | **~90%** ✅ corregido | 🟢 Baja |

**Promedio simple (mismo método que la medición original, 13 categorías, sin ponderar): ~72%** — sube desde el ~56% real que arroja el promedio aritmético de los 13 valores originales (el "~62%" reportado en la primera versión de este documento fue una estimación cualitativa redondeada, no un cálculo estricto; se corrige aquí para que la comparación antes/después sea honesta y verificable).

**No se alcanzó el objetivo de 75%.** La razón principal: **Onboarding sigue en 0%** (no estaba entre los 4 puntos de esta parte del sprint) y representa, por sí solo, casi 8 puntos del promedio total si se llevara a un nivel razonable. Los 4 ítems sí corregidos subieron su similitud individual de forma sustancial (Splash y Recuperación de contraseña pasaron de 0% a 68-78%, Perfil de 12% a 50%, Estados de error de 65% a 90%), pero el peso de Onboarding y de Nutrición (45%, sin tocar, fuera de alcance por ser una decisión de producto ya documentada) mantiene el promedio por debajo del objetivo. Ver sección final "Por qué no se llegó a 75% y qué lo cerraría".

---

## 1. Splash

**Similitud: 0%**

Figma diseña una pantalla de splash completa: fondo con textura de contornos topográficos + partículas de colores, wordmark "GYMIA" centrado en mayúsculas, subtítulo "NÚCLEO ADAPTATIVO" debajo en tipografía más pequeña y espaciada (letter-spacing amplio).

**✅ Corregido en Sprint Figma Parte 1 — Similitud actual: ~68%**

`src/splash.tsx` ahora exporta `BrandedSplashScreen`: wordmark "GYMIA" (mismo peso/tamaño que el resto de la app, `Outfit_700Bold`) + subtítulo "NÚCLEO ADAPTATIVO" con letter-spacing amplio, sobre `AppBackground`. Se muestra en `app/_layout.tsx` mientras `!fontsLoaded || isLoading` (fuentes o sesión guardada aún resolviéndose), reemplazando lo que antes era una pantalla en blanco tras el splash nativo genérico de Expo.

- **Componentes ya presentes:** wordmark, subtítulo, fondo de marca.
- **Diferencias que persisten:** mismo gap de fondo transversal (sin textura de contornos + partículas, ver Login); el splash **nativo** (el que se ve antes de que cargue el bundle de JS) sigue siendo el genérico de Expo — este componente solo reemplaza el estado de carga posterior, no el ícono nativo, ya que eso requeriría generar un asset de imagen nuevo, fuera de alcance de un cambio solo de código.
- **Limitación de verificación honesta:** en el entorno de desarrollo web, la carga de la sesión guardada (`localStorage`) es prácticamente instantánea, por lo que no fue posible capturar una pantalla en vivo mostrando este estado (aparece y desaparece en una fracción de segundo). Se validó por revisión de código + `tsc`/`lint` limpios, no por captura visual — de ahí el 68% en vez de un número más alto: refleja alta confianza en la implementación, no certeza visual confirmada. Se recomienda verificar en un dispositivo real (donde la carga de fuentes puede tomar más tiempo perceptible) antes de subir esta cifra.
- **Prioridad: 🟢 Baja** (bajó desde 🔴 Alta).

## 2. Onboarding

**Similitud: 0%**

Figma diseña un flujo de 4 pasos con barra de progreso segmentada ("PASO 1 DE 4"), selección de objetivo (Ganar músculo / Ganar fuerza / Fuerza + músculo) con tarjetas seleccionables e iconos, selector de nivel de experiencia (Principiante/Intermedio) como pills, y un cuadro de ayuda contextual.

**Estado real:** no existe ningún archivo ni ruta de onboarding. Tras `signUp`, el usuario aterriza directo en Evolución General.

- **Componentes faltantes:** las 4 pantallas completas del flujo, barra de progreso segmentada, tarjetas de selección con icono+radio, pills de nivel de experiencia.
- **Prioridad: 🟡 Media.** No bloquea el uso de la app (el usuario simplemente no pasa por una personalización inicial), pero es una pieza de producto diseñada y nunca construida — vale la pena una decisión consciente de producto (¿se construye para v1.1, o se descarta el diseño?) en vez de dejarlo indefinido.

## 3. Login

**Similitud: ~88%**

Estructura, copy, campos, botones y jerarquía coinciden con alta fidelidad: wordmark + tagline, campos de correo/contraseña, "¿Olvidaste tu contraseña?", botón "Iniciar sesión", separador "o continúa con", 2 botones sociales, footer "¿No tienes cuenta? Regístrate".

**Diferencias encontradas:**
- **Fondo:** Figma usa el componente `GymIASplashBackground` — textura de contornos topográficos con partículas de colores dispersas (puntos cian, verde-lima, blancos) sobre el fondo oscuro. La app real (`AppBackground.tsx`) usa una aproximación deliberadamente simplificada: solo 2 manchas de blur (cian arriba-izquierda, lima abajo-derecha), sin textura de contornos ni partículas — documentado como decisión consciente en el propio código, pero sigue siendo la brecha visual más notoria de toda la app, presente en **todas** las pantallas.
- **Spacing:** muy cercano, sin diferencias notorias en el padding vertical entre secciones.
- **Tipografía:** el wordmark "GymIA" coincide en peso/tamaño; el resto de textos también.
- **Colores:** coinciden (mismo verde de acento, mismo fondo oscuro, mismo gris de texto secundario).
- **Iconografía:** los íconos de Apple/Google en los botones sociales coinciden.

**Prioridad: 🟢 Baja.** El gap de fondo es transversal a toda la app (ver sección de roadmap) — no es específico de Login.

## 4. Registro

**Similitud: ~82%**

Misma estructura base que Login (wordmark, campos, botones sociales), con el campo adicional "Nombre".

**Diferencias encontradas:**
- **Copy del botón principal:** la app real dice **"Registrarme"**; Figma dice **"Crear cuenta"** — diferencia de texto directa, fácil de corregir.
- **Texto legal:** Figma muestra "Antes de continuar, revisa nuestros términos y política de privacidad." con "Términos de uso" y "Política de privacidad" como dos enlaces separados y subrayados; la app real muestra una sola línea genérica "Al continuar, aceptas los Términos y la Política de Privacidad." sin que esas palabras sean enlaces reales (no navegan a ningún lado).
- **Fondo:** mismo gap que Login (textura simplificada).
- **Resto** (spacing, tipografía, colores, iconografía): coincide bien.

**Prioridad: 🟢 Baja** — diferencias menores de copy, no estructurales.

## 5. Recuperación de contraseña

**Similitud: 0%**

Figma diseña una pantalla completa: botón de volver, título "Restablecer contraseña", subtítulo explicativo, campo de correo, botón "Enviar enlace", y footer "¿Recordaste tu contraseña? Inicia sesión" — además de un flujo posterior a "correo-enviado".

**✅ Corregido en Sprint Figma Parte 1 — Similitud actual: ~78%**

Nueva pantalla `src/app/(auth)/forgot-password.tsx`, verificada en vivo en el navegador: botón de volver, título "Restablecer contraseña", subtítulo, campo de correo con validación de formato, botón "Enviar enlace", footer "¿Recordaste tu contraseña? Inicia sesión" — todo presente y coincidiendo con el layout de Figma. El enlace "¿Olvidaste tu contraseña?" en Login ahora navega aquí (`router.push('/forgot-password')`) en vez de no hacer nada.

- **Decisión consciente que se aparta de Figma (documentada, no un descuido):** no existe ningún endpoint de backend para recuperación de contraseña, y esta tarea no podía tocar backend ni crear funcionalidades nuevas. Figma diseña un estado posterior "correo-enviado" que simula un envío exitoso — **implementarlo tal cual habría sido mentirle al usuario** (ningún correo se enviaría realmente). En su lugar, al enviar el formulario se muestra un mensaje honesto: *"Muy pronto podrás restablecer tu contraseña desde aquí. Por ahora, si perdiste el acceso a tu cuenta, contáctanos directamente."* Esta es la causa principal de no llegar a un porcentaje más alto — es una discrepancia deliberada por integridad, no un defecto a corregir.
- **Prioridad: 🟢 Baja** (bajó desde 🔴 Alta) — el enlace ya no es un callejón sin salida.

## 6. Home / Evolución General

**Similitud: ~92%**

Esta es la pantalla de aterrizaje tras login (`(app)/evolucion/index.tsx`). Ya fue auditada contra Figma en la fase de construcción del módulo Evolución, con un hallazgo de fidelidad de texto ya corregido en su momento ("Analíticas avanzadas de tus levantamientos principales").

Estructura confirmada en esta auditoría: header "Evolución General" + subtítulo, tarjeta "Puntuación de Progreso" con barra y mensaje contextual, grid "Módulos de Análisis" (Fuerza/Cuerpo/Hábitos/Historial/Insights IA/Más — solo los primeros dos habilitados), sección "Récords Recientes".

**Diferencias encontradas:**
- Mismo gap de fondo transversal (textura simplificada).
- Los shortcuts deshabilitados (Hábitos, Historial, Insights IA, Más) se muestran atenuados — coincide con el patrón de Figma de mostrar funcionalidad futura de forma visible pero inactiva.

**Prioridad: 🟢 Baja.**

## 7. Entrenar

**Similitud: ~80% (estimado)**

**Nota de metodología:** no se localizó un nodo de Figma específico llamado "Entrenar" en esta pasada de auditoría (búsqueda por nombre exacto no encontró el frame) — esta cifra se basa en la fidelidad general ya lograda en el resto de la app y en que el módulo fue construido siguiendo activamente el Figma en su fase de creación, **no** en una comparación pixel-a-pixel fresca como el resto de este documento. Marcado explícitamente como de menor confianza.

Estado vacío verificado en vivo: título "Entrenar", subtítulo "Tu entrenamiento de hoy está listo", sección "Mis Rutinas (0)", mensaje vacío, CTA "+ Nueva Rutina" (estilo de borde, no botón sólido — distinto del patrón `PrimaryButton` usado en el resto de la app, vale la pena confirmar si es intencional).

**Prioridad: 🟡 Media** — no por evidencia de una brecha grande, sino por la falta de verificación fresca: se recomienda una auditoría visual dedicada a este módulo antes de confiar en el número.

## 8. Evolución (Fuerza / Strength)

**Similitud: ~90%**

Subpantalla `evolucion/strength.tsx`, ya auditada en la fase de construcción del módulo (gráfico `LineChart` con `react-native-svg`, chips de selección de ejercicio, tarjeta de volumen semanal). Sin cambios desde esa auditoría.

**Prioridad: 🟢 Baja.**

## 9. Composición Corporal

**Similitud: ~90%**

Verificado en esta auditoría: el subtítulo "Calibración biométrica y antropométrica" coincide **exactamente** con el texto de Figma capturado en la fase de diseño de este módulo. Estructura de 4 tarjetas de métricas (Peso, % Grasa, Masa Muscular, Cintura), gráfico de tendencia, sección de fotos de progreso — todo construido siguiendo el Figma real.

**Diferencias encontradas:**
- Mismo gap de fondo transversal.
- Los iconos de las tarjetas de métrica en Figma no se replicaron (la app usa solo texto, sin iconografía por métrica) — diferencia menor de iconografía.

**Prioridad: 🟢 Baja.**

## 10. Nutrición

**Similitud: ~45%**

**Este es el gap más importante entre los módulos "completos" del MVP**, y tiene una causa raíz clara: el Figma original (`Gymia-Nutrition-Ecosystem-Board`) diseña un ecosistema con IA — dashboard "Comienza tu Día" con anillo de progreso de calorías, macros con barras, escáner de foto con IA ("Nutria AI+"), escáner de código de barras, biblioteca de recetas. **Ese diseño nunca se construyó** porque el MVP de Nutrición excluyó deliberadamente IA por foto y código de barras (decisión de producto documentada en `NUTRITION_MVP_ROADMAP.md`).

La pantalla real "Diario Nutricional" es una **interpretación propia** construida sobre el mismo sistema de diseño (mismos tokens de color/tipografía/spacing, mismos componentes `Card`/`PrimaryButton`), pero con un layout distinto porque resuelve un alcance de producto distinto (registro manual, sin IA).

- **Componentes faltantes:** anillo de progreso circular de calorías (la app usa una tarjeta de texto plano "Total de hoy"), escáner de foto/código (fuera de alcance, no es un "faltante" sino una decisión), biblioteca de recetas.
- **Diferencias de spacing/tipografía/colores:** ninguna relevante — el sistema de diseño base se respetó.
- **Iconografía:** el Figma usa iconos ilustrativos por cada sección (cámara, código de barras, plato); la app real no tiene equivalente porque esas secciones no existen.

**Prioridad: 🟡 Media.** No es un defecto de ejecución — es la consecuencia visual esperada de un recorte de alcance ya decidido y documentado. Se marca como Media (no Baja) porque, a diferencia de Entrenar/Evolución/Composición Corporal, aquí la diferencia es grande y notoria para cualquiera que compare con el Figma, y debería comunicarse explícitamente a quien revise el diseño para que no se lea como un error de implementación.

## 11. Perfil

**Similitud: ~12%**

**El gap más grande de toda la aplicación.** Figma diseña un Perfil rico: avatar circular con foto, nombre + nivel + racha de días consecutivos, 3 tarjetas de métricas rápidas (Altura/Peso/% Grasa), lista "Ajustes de Cuenta" con 6 opciones (Datos Personales, Objetivos y Prioridades, Progreso y Logros, Integraciones de Salud, Membresía Premium, Privacidad y Seguridad) cada una con icono + chevron, y sección "Ecosistema GYMIA" con 3 atajos (Rutinas, Nutria IA, Escuadrón).

**Estado original:** título "Perfil", email en texto plano, botón "Cerrar sesión". Nada más.

**✅ Corregido en Sprint Figma Parte 1 — Similitud actual: ~50%**

Reconstruido y verificado en vivo con un usuario real: tarjeta de encabezado con avatar circular (inicial del correo, ya que el backend no almacena nombre de usuario), email, "Miembro desde {mes y año}" (dato real, de `user.createdAt`); fila de tarjetas de estadísticas con datos **reales** reutilizando endpoints ya existentes — número de rutinas (`GET /workouts/routines`) y peso más reciente si existe (`GET /body-metrics/latest`), sin fabricar ningún dato; sección "Cuenta" con "Cerrar sesión" estilizado como fila de lista (más cerca del patrón de Figma que un botón centrado aislado).

- **Componentes que siguen faltando, deliberadamente:** nivel y racha de días (no existe ningún sistema de XP/gamificación en el backend — inventar un número sería fabricar datos falsos, no se hizo), la lista de 6 "Ajustes de Cuenta" (ninguna tiene una pantalla de destino real — construir 6 filas que no llevan a ningún lado habría recreado exactamente el mismo problema que se corrigió en Recuperación de contraseña), y la sección "Ecosistema GYMIA" con sus 3 atajos.
- **Diferencias de tipografía/color:** coinciden — se usan los mismos tokens que el resto de la app.
- **Iconografía:** sigue habiendo un gap — Figma usa iconos por cada fila de ajustes; al no construir esas filas, tampoco hay iconos que mostrar.
- **Prioridad: 🟡 Media** (bajó desde 🔴 Alta). El salto de 12% a 50% es real y verificado, pero cerrar el resto de la brecha requiere trabajo de backend (nivel/racha) o nuevas pantallas de ajustes (datos personales, objetivos, privacidad) — ninguna de las dos cosas correspondía a esta tarea.

## 12. Estados vacíos (transversal)

**Similitud: ~85%**

Patrón consistente y bien logrado en toda la app: mensaje centrado en gris secundario + CTA de acción primaria, verificado en Entrenar ("Todavía no tienes rutinas..."), Composición Corporal ("Todavía no tienes mediciones..."), Nutrición ("Todavía no registras comidas hoy..."). El tono y la estructura (explicación breve + CTA) coincide con el patrón de estados vacíos que Figma usa en las pantallas donde se pudo verificar.

**Prioridad: 🟢 Baja.**

## 13. Estados de error (transversal)

**Similitud: ~65%**

Visualmente consistentes: texto en rojo (`#ff6b6b`), centrado, mismo patrón en todas las pantallas con formularios.

**✅ Corregido en Sprint Figma Parte 1 — Similitud actual: ~90%**

Nuevo `src/lib/errorTranslations.ts`, conectado en `apiRequest` (`api.ts`), sin tocar el backend: traduce ~25 mensajes exactos de excepciones de negocio conocidas (`AuthService`, `WorkoutsService`, `BodyCompositionService`, `NutritionService`, `JwtAuthGuard`) más patrones genéricos para los mensajes que produce automáticamente `class-validator` en el `ValidationPipe` (formato de correo, longitud mínima/máxima, campos vacíos, tipos, UUID, fechas, etc.), incluyendo una traducción de los nombres de campo (`email` → "El correo electrónico", `weightKg` → "El peso", etc.) para que el mensaje final se lea natural en español.

**Verificado en vivo:** un login con credenciales incorrectas ahora muestra **"Correo o contraseña incorrectos"** en vez de "Invalid credentials".

- **Por qué no es 100%:** el diccionario de patrones de `class-validator` cubre los casos más comunes, no la totalidad matemática de cada mensaje posible que esa librería puede generar — un campo con una regla de validación poco común podría seguir devolviendo texto en inglés como respaldo (la función nunca lanza ni oculta el mensaje, solo lo deja sin traducir si no reconoce el patrón). No se intentó una traducción campo-por-campo de cada DTO por ser inabarcable sin tocar el backend.
- **Prioridad: 🟢 Baja** (bajó desde 🟡 Media).

---

# Roadmap de corrección visual (ordenado por impacto)

## Fase 1 — Bloqueantes de producto (antes de cualquier beta) — ✅ Completada (Sprint Figma Parte 1)

1. ~~**Recuperación de contraseña**~~ ✅ Hecho — pantalla construida, enlace conectado.
2. ~~**Mensajes de error en inglés**~~ ✅ Hecho — traducción centralizada en el cliente, sin tocar backend.

## Fase 2 — Gap estructural grande (alto impacto visual) — ✅ Completada parcialmente (Sprint Figma Parte 1)

3. ~~**Perfil**~~ ✅ Hecho — avatar, tarjeta de encabezado, estadísticas reales, sección de cuenta. Queda pendiente (fuera de alcance de un sprint solo-mobile): nivel/racha (requiere backend) y las 6 filas de ajustes (requieren pantallas nuevas con destino real).
4. ~~**Splash**~~ ✅ Hecho — wordmark + subtítulo sobre el fondo de marca, mostrado mientras cargan fuentes/sesión. Pendiente de verificación visual en dispositivo real (ver sección 1 de este documento).

## Fase 3 — Consistencia visual transversal (siguiente candidata — Sprint Figma Parte 2)

5. **Fondo (`AppBackground`)**: evaluar si vale la pena acercarse más a la textura de contornos + partículas de Figma (afecta a las 12 pantallas existentes por igual) — es la diferencia visual más repetida de todo este documento, aunque individualmente menor en cada pantalla. Es la palanca de mayor impacto transversal que queda disponible sin tocar backend ni inventar datos.
6. **Copy de botones/textos**: corregir "Registrarme" → "Crear cuenta" y el texto legal de Registro para que coincida con Figma — cambios de una línea, bajo esfuerzo.

## Fase 4 — Decisiones de producto, no solo de diseño

7. **Onboarding**: decidir explícitamente si se construye para v1.1 o se descarta — no es una corrección visual "gratis", requiere nueva lógica de flujo post-registro. **Es la palanca individual más grande para subir el promedio global** (sigue en 0%, ver sección siguiente).
8. **Nutrición**: no requiere corrección visual — el gap es la consecuencia esperada de un recorte de alcance ya decidido. Documentar esto explícitamente para quien compare contra Figma sin este contexto, y revisar si al construir IA/código de barras (fuera de este MVP) se retoma el layout original.

## Fuera de este roadmap

9. **Entrenar**: antes de priorizar cualquier corrección, hacer la auditoría visual fresca que esta pasada no pudo completar (no se localizó el nodo de Figma) — no se puede corregir con confianza lo que no se ha comparado directamente.

---

## Por qué no se llegó a 75% y qué lo cerraría

El objetivo del Sprint Figma Parte 1 era subir el promedio de ~62% (estimación cualitativa original) a al menos 75%. El resultado medido con el mismo método (promedio simple de las 13 categorías) es **~72%** — con el detalle honesto de que la cifra base real era ~56%, no 62% (ver nota en el resumen ejecutivo), así que la subida efectiva fue de **~16 puntos porcentuales**, mayor de lo que el propio 62%→72% sugiere a simple vista.

**No llegar a 75% no fue por ejecución floja de los 4 ítems** — los cuatro subieron sustancialmente (Splash y Recuperación de contraseña de 0% a 68-78%, Perfil de 12% a 50%, Estados de error de 65% a 90%). La razón es aritmética: dos categorías de peso considerable se quedaron sin tocar por estar fuera del alcance explícito de esta parte del sprint:

- **Onboarding (0%, sin cambios)** — por sí sola, esta categoría representa ~7.7 puntos del promedio de 13. Llevarla a un 70% (un flujo básico de 4 pasos, sin backend de personalización real — solo guardando la preferencia localmente o descartándola) subiría el promedio global a **~77%**, superando el objetivo solo con este ítem.
- **Nutrición (45%, sin cambios)** — deliberadamente no tocado porque su gap es una decisión de producto ya tomada (sin IA/escaneo en el MVP), no un defecto a corregir.

**Recomendación para un Sprint Figma Parte 2** (si se quiere cruzar 75% con confianza): priorizar Onboarding sobre cualquier otro ajuste visual menor — es la única pieza que, por su peso individual en el promedio, puede mover la aguja lo suficiente por sí sola.
