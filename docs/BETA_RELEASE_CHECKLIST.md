# Checklist de Lanzamiento Beta

**Fecha de creación:** 2026-09-24
**Origen:** sección 5 de `docs/V1_RELEASE_STATUS.md`, mantenido como documento vivo — actualizar cada vez que se cierre un ítem, no reescribir desde cero.

---

- [x] **Conectar el refresh token en mobile**: persistir `refreshToken`, interceptar `401` de token expirado, reintentar con `/auth/refresh`. **Resuelto el 2026-09-24** — ver detalle abajo.
- [ ] Crear el bucket `progress-photos` (privado) y configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Mover `API_BASE_URL` de mobile a variable de entorno (`EXPO_PUBLIC_API_URL` o equivalente), con valor de staging/producción
- [ ] Configurar `CORS_ORIGIN` con el dominio real de la app (no el default de desarrollo)
- [ ] Confirmar `JWT_SECRET` de producción (rotado, no el usado en desarrollo)
- [ ] Probar el flujo completo de fotos de progreso en un dispositivo real (no solo navegador)
- [ ] CI básica para mobile (`tsc --noEmit` + `expo lint` como mínimo, en cada PR)
- [ ] Al menos tests de humo en mobile para el flujo de Auth (login/registro/logout)
- [ ] Decisión consciente sobre recuperación de contraseña: implementarla antes del beta, o comunicar explícitamente su ausencia a los testers
- [ ] Revisión de privacidad para las fotos de progreso (aunque sea informal, antes de reclutar testers externos)
- [ ] Smoke test manual completo de los 5 módulos con un usuario nuevo, de punta a punta, inmediatamente antes de invitar al primer tester

---

## Detalle — Refresh token en mobile (resuelto)

**Alcance:** solo `GymIA-Mobile-App`, sin tocar backend (el mecanismo de refresh/rotación ya existía desde el sprint de deuda técnica) y sin features nuevas — únicamente conectar lo que ya estaba construido en el backend.

**Arquitectura implementada:**
- `src/lib/authSession.ts` (nuevo) — puente entre `api.ts` (fuera de React, sin acceso a hooks) y `ctx.tsx` (dueño del estado de sesión): un registro de handlers (`getRefreshToken`, `setTokens`, `clearSession`) que `SessionProvider` registra una vez al montar.
- `src/lib/api.ts` — `apiRequest` ahora intercepta cualquier `401` en una petición que llevaba un token: llama a `refreshAccessToken()` (deduplicado con una promesa compartida, para que peticiones simultáneas que expiran al mismo tiempo no disparen renovaciones en paralelo — el refresh token del backend es de un solo uso), reintenta la petición original una vez con el token nuevo, y si el refresh también falla, cierra la sesión vía `clearSession()`.
- `src/ctx.tsx` — `SessionProvider` ahora persiste también el `refreshToken` (`useStorageState('session_refresh_token')`, mismo mecanismo seguro que el access token — `expo-secure-store` en nativo, `localStorage` en web) y lo mantiene disponible para `api.ts` a través de un ref actualizado en un `useEffect` (no durante el render, por la regla `react-hooks/refs`).
- `LoginResult` (tipo en `api.ts`) ahora incluye `refreshToken` — cambio de tipo puramente aditivo, coherente con lo que el backend ya devolvía desde el sprint de deuda técnica.

**Validación en vivo (no solo tsc/lint):** se bajó temporalmente `JWT_EXPIRES_IN` a `8s` en el backend (revertido a `1d` al terminar, sin dejar cambios de código), se registró un usuario de prueba real en el navegador, y se confirmó por inspección de red:
1. Con el access token ya expirado, una petición normal (`GET /meals`) devuelve `401`.
2. Automáticamente se dispara `POST /auth/refresh` → `200`.
3. La petición original se reintenta con el token nuevo → `200` — **sin que el usuario notara nada** (sin redirección a login, sin mensaje de error, la pantalla cargó con normalidad).
4. Con el refresh token revocado manualmente (simulando que también expiró/fue invalidado), una nueva petición tras expirar el access token resultó en cierre de sesión automático y redirección a `/login` — confirmando el manejo de fallo pedido explícitamente.

Usuario y datos de prueba eliminados al terminar; 0 residuos verificados.

**Validación estática:**
```
$ npx tsc --noEmit
(sin errores)

$ npm run lint
✖ 2 problems (0 errors, 2 warnings)   — ambos preexistentes, sin relación (useStorageState.ts)
```

**No incluido en esta tarea** (fuera de alcance explícito): logout que revoque el refresh token en el backend (no existe endpoint `POST /auth/logout` — `signOut()` solo limpia el almacenamiento local; el refresh token revocado queda simplemente sin usarse hasta expirar en 30 días). No es una regresión de esta tarea — es el mismo comportamiento que existía antes de conectar el refresh token, documentado aquí para que no se pierda de vista.
