# GymIA — Estado de Cierre v1

**Fecha:** 2026-09-24
**Repos:** `GymIA-API` (`https://github.com/iker-ia-mx/GymIA-API`) y `GymIA-Mobile-App` (`https://github.com/iker-ia-mx/GymIA-Mobile-App`)

---

# 1. Funcionalidades completadas

| Módulo | Backend | Mobile | Auditado en vivo |
|---|---|---|---|
| **Auth** | Registro, login, JWT, bcrypt, refresh tokens con rotación | Login/registro, sesión persistida (`expo-secure-store`/`localStorage`) | Sí |
| **Entrenar** | Rutinas, sesiones, series, cálculo de PR | Rutina nueva, sesión activa, registro de series | Sí |
| **Evolución** | Resumen de progreso, récords recientes (14 días), 1RM estimado (Epley) | Dashboard, gráfico de fuerza (`LineChart`) | Sí |
| **Composición Corporal** | `BodyMetric`, `ProgressPhoto` con signed URLs de Supabase Storage | 4 pantallas (Home, Agregar Medición, Galería, Agregar Foto) | Sí (backend); mobile verificado salvo el picker de cámara/galería real — ver Riesgos |
| **Nutrición** | `Food`, `Meal`, `MealItem`, `NutritionGoal`, resumen diario en vivo | 4 pantallas (Diario, Registrar Comida, Resumen, Historial) | Sí, flujo completo end-to-end |

Los 5 módulos comparten la misma arquitectura base: `JwtAuthGuard` + `@CurrentUser()`, filtrado por `userId` en cada query, relación explícita con `User` con `onDelete: Cascade`, y el mismo patrón de módulo NestJS (`*.module.ts`/`*.service.ts`/`*.controller.ts`/`dto/*.ts`) en backend, y de pantalla mobile (`useFocusEffect` + `Card`/`PrimaryButton`/`TextField` reutilizados) en el cliente.

**Suite de tests del backend:** 57 tests (`AuthService`, `WorkoutsService`, `EvolutionService`, `NutritionService`), 0 tests en `mobile` (ver sección 3).

---

# 2. Funcionalidades fuera de alcance (v1)

Excluidas deliberadamente de Composición Corporal y Nutrición desde el spike de Fase 3, no por falta de tiempo:

- **IA por fotografía** — reconocimiento de alimentos por foto (diseñado en `NUTRITION_TECHNICAL_PLAN.md`, sin implementar).
- **Código de barras** — escaneo y lookup contra Open Food Facts/USDA (diseñado, sin implementar; cobertura LATAM sin validar empíricamente).
- **Offline sync** — diseñado en `NUTRITION_TECHNICAL_PLAN.md` sección 8, explícitamente no construido en ningún módulo del proyecto.
- **Recomendaciones IA** — "Nutria IA" generando dietas/macros basados en historial de entrenamiento (visto en el Figma original, nunca planificado para v1).

---

# 3. Deuda técnica pendiente

Estado real de cada ítem — algunos ya se resolvieron durante el desarrollo de v1, otros siguen abiertos. No se presentan todos como pendientes por igual:

| Ítem | Estado | Detalle |
|---|---|---|
| **Refresh token en mobile** | ⬜ Pendiente | El backend emite y rota refresh tokens (`POST /auth/refresh`) desde el sprint de deuda técnica, pero `mobile/src/ctx.tsx` solo guarda `accessToken` — no hay interceptor de `401` ni lógica para usar el refresh token. El usuario debe volver a iniciar sesión manualmente cuando el JWT expira (`1d`). |
| **Bucket `progress-photos`** | ⬜ Pendiente | Paso manual en Supabase Storage (crear el bucket, marcarlo privado, límite de tamaño) — nunca ejecutado en esta sesión, requiere acceso al dashboard de Supabase. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | ⬜ Pendiente | Vacío en `.env` — sin él, `/progress-photos/*` falla de forma controlada (`500`) pero no funciona. |
| **CI/CD** | 🟡 Parcial | `GymIA-API` tiene `.github/workflows/ci.yml` (lint + build + test). `GymIA-Mobile-App` **no tiene ningún workflow**. |
| **Tests mobile** | ⬜ Pendiente | Cero archivos de test en todo el repo mobile — toda la verificación ha sido manual en navegador. |
| **`.env.example`** | ✅ Resuelto (API) | Creado en el sprint de deuda técnica con las 9 variables requeridas. Mobile no tiene `.env` en absoluto — la URL de la API sigue hardcodeada (`http://localhost:3000` en `lib/api.ts`), un gap real para producción no cubierto por este ítem tal como está listado. |
| **CORS** | ✅ Resuelto (API) | Restringido vía `CORS_ORIGIN` con default seguro de desarrollo. Falta configurar el valor de producción cuando exista un dominio real. |
| **Rate limiting** | ✅ Resuelto (API) | `@nestjs/throttler` global (60/min) + estricto en `/auth/*` (10/min), verificado en vivo. |

---

# 4. Riesgos abiertos

- **Mobile no tiene configuración de entorno** — `API_BASE_URL` hardcodeado a `localhost:3000` en `src/lib/api.ts`. La app no puede apuntar a un backend real de staging/producción sin editar código y reconstruir.
- **Sesión sin renovación automática** — combinado con el JWT de 1 día y el refresh token no conectado (sección 3), cualquier beta tester verá la sesión expirar sin aviso claro y tendrá que re-loguearse.
- **Cero cobertura de tests y CI en mobile** — cualquier regresión en las 12+ pantallas existentes se detecta solo manualmente. Es el mayor punto ciego de calidad del proyecto hoy.
- **Composición Corporal — fotos de progreso sin probar en dispositivo real** — el flujo de subida (`expo-image-picker` → signed URL → Supabase Storage) nunca se ejecutó de punta a punta porque el bucket no existe; tampoco se probó el picker de cámara/galería nativo (solo verificado en navegador, donde no se activan permisos reales de cámara).
- **Privacidad de fotos de progreso sin revisión legal** — dato personal sensible (imágenes corporales), sin política de privacidad ni flujo de consentimiento explícito.
- **Sin recuperación de contraseña ni verificación de email** — pendiente desde `docs/STATUS.md` original, sigue sin resolverse; un beta tester que olvide su contraseña queda bloqueado sin ruta de recuperación.
- **Sin endpoint de borrado de cuenta** — un usuario no puede eliminar su propia cuenta ni sus datos; relevante si se recluta beta testers externos con expectativas de privacidad.
- **`DailyNutritionSummary` no materializada** — decisión consciente para v1 (agregación en vivo, como `EvolutionService`), pero sin datos reales de uso que confirmen que escala bien más allá de un puñado de usuarios beta.
- **Perfil prácticamente sin construir** (~20%, solo email + logout) — es una de las 4 pestañas principales de la app.

---

# 5. Checklist de lanzamiento beta

- [ ] Crear el bucket `progress-photos` (privado) y configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Mover `API_BASE_URL` de mobile a variable de entorno (`EXPO_PUBLIC_API_URL` o equivalente), con valor de staging/producción
- [ ] Conectar el refresh token en mobile: persistir `refreshToken`, interceptar `401` de token expirado, reintentar con `/auth/refresh`
- [ ] Configurar `CORS_ORIGIN` con el dominio real de la app (no el default de desarrollo)
- [ ] Confirmar `JWT_SECRET` de producción (rotado, no el usado en desarrollo)
- [ ] Probar el flujo completo de fotos de progreso en un dispositivo real (no solo navegador)
- [ ] CI básica para mobile (`tsc --noEmit` + `expo lint` como mínimo, en cada PR)
- [ ] Al menos tests de humo en mobile para el flujo de Auth (login/registro/logout)
- [ ] Decisión consciente sobre recuperación de contraseña: implementarla antes del beta, o comunicar explícitamente su ausencia a los testers
- [ ] Revisión de privacidad para las fotos de progreso (aunque sea informal, antes de reclutar testers externos)
- [ ] Smoke test manual completo de los 5 módulos con un usuario nuevo, de punta a punta, inmediatamente antes de invitar al primer tester

---

# 6. Recomendación para v1.1

**Antes de sumar cualquier feature nueva, cerrar la deuda que bloquea un beta real** — en este orden:

1. **Refresh token en mobile + `API_BASE_URL` como variable de entorno.** Sin esto, ningún beta tester externo puede usar la app de forma sostenida (sesión hardcodeada a localhost, expira sin renovación). Es lo único que impide técnicamente invitar a un primer usuario real hoy mismo.
2. **Bucket de Storage + prueba real en dispositivo.** Composición Corporal está "completo" en el papel pero su feature más visible (fotos de progreso) nunca se ejecutó de punta a punta.
3. **CI + tests mínimos en mobile.** No es bloqueante para un beta cerrado con pocos testers, pero cada semana que se pospone crece el riesgo de una regresión silenciosa en un repo que ya tiene 4 módulos y 12+ pantallas.

**Después de eso**, y solo con datos reales de uso del beta, decidir entre:
- **Código de barras para Nutrición** (menor esfuerzo, sin costo de IA, mejora directa de UX ya validada como el mayor punto de fricción del registro manual) — candidato más fuerte por relación esfuerzo/valor.
- **Perfil real** (edición de datos, preferencias) — si el feedback del beta señala que los testers lo notan ausente.
- **IA por foto** — solo después de correr el bake-off de proveedores ya recomendado en `NUTRITION_TECHNICAL_PLAN.md`, y solo si el registro manual + código de barras no es suficiente para los testers reales.

No se recomienda empezar Offline Sync ni Recomendaciones IA en v1.1 — ambas son las piezas de mayor complejidad de todo el roadmap y ninguna tiene todavía evidencia de demanda real de un solo usuario beta.
