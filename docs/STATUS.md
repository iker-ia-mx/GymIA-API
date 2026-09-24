# GymIA — Estado técnico actual

_Última actualización: 2026-09-24_

GymIA está compuesto por dos repositorios independientes (no es un monorepo), hermanos bajo `~/GymIA/`:

- **`api/`** — backend NestJS (este repositorio).
- **`mobile/`** — app Expo/React Native.

## Arquitectura actual

**Backend (`api/`)**
- NestJS 12, módulos ESM puro (`"type": "module"`), TypeScript con `moduleResolution: nodenext` (imports relativos requieren extensión `.js`).
- Persistencia: Prisma ORM 6.19.3 contra Postgres de Supabase.
  - `DATABASE_URL`: conexión pooled (pgbouncer, puerto 6543) — usada en runtime.
  - `DIRECT_URL`: conexión directa (puerto 5432) — reservada para migraciones.
- Autenticación: JWT stateless (`@nestjs/jwt`) + hash de contraseñas con `bcrypt` nativo. Sin refresh tokens ni tabla de sesiones.
- Validación: `class-validator`/`class-transformer` con `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- CORS habilitado sin restricción de origen (`app.enableCors()`) — pensado para desarrollo.
- Tests: Vitest (`vitest.config.ts` unit, `vitest.config.e2e.ts` e2e). Lint: `oxlint --type-aware`.

**Mobile (`mobile/`)**
- Expo SDK 57 (`~57.0.24`), React 19.2.3, React Native 0.86.3.
- Navegación: Expo Router (file-based, `src/app/`), con soporte de rutas tipadas (`experiments.typedRoutes`).
- Sesión de auth: React Context (`src/ctx.tsx`) + hook `useStorageState` — persiste el JWT en `expo-secure-store` (Keychain/Keystore) en iOS/Android, y en `localStorage` en web.
- Enrutado protegido con `Stack.Protected`: grupo `(auth)` (sin sesión) vs. grupo `(app)` (con sesión), conmutación automática y reactiva.
- Soporte web añadido (`react-dom`, `react-native-web`) solo para poder probar en navegador durante desarrollo.

## Módulos implementados

**`api/src/`**
- `prisma/` — `PrismaModule` (`@Global()`) + `PrismaService` (extiende `PrismaClient`, conecta/desconecta en los hooks de ciclo de vida de Nest).
- `auth/` — `AuthModule`, `AuthController`, `AuthService`, `dto/register.dto.ts`, `dto/login.dto.ts`.
- `app.module.ts` — raíz: `ConfigModule.forRoot({ isGlobal: true })`, `PrismaModule`, `AuthModule`.
- Scaffold por defecto sin modificar: `AppController`/`AppService` (ruta `GET /`).

**`mobile/src/`**
- `lib/api.ts` — cliente API tipado (`registerRequest`, `loginRequest`, `ApiError`).
- `useStorageState.ts` — storage multiplataforma (patrón oficial de Expo).
- `ctx.tsx` — `SessionProvider`/`useSession` (`signIn`, `signUp`, `signOut`, `session`, `user`, `isLoading`).
- `splash.tsx` — controla el splash screen mientras se resuelve la sesión guardada.
- `app/_layout.tsx`, `app/(auth)/{_layout,index,login,register}.tsx`, `app/(app)/{_layout,index}.tsx`.

## Endpoints disponibles

| Método | Ruta | Body | Respuesta éxito | Respuesta error |
|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `201` `{ id, email, createdAt }` | `409` email duplicado · `400` validación |
| POST | `/auth/login` | `{ email, password }` | `200` `{ accessToken, user }` | `401` credenciales inválidas · `400` validación |
| GET | `/` | — | `200` texto plano (scaffold de Nest, sin uso funcional) | — |

Base URL en desarrollo: `http://localhost:3000`.

## Variables de entorno requeridas (`api/.env`)

| Variable | Uso | Notas |
|---|---|---|
| `DATABASE_URL` | Conexión Prisma en runtime | Pooled (pgbouncer), Supabase |
| `DIRECT_URL` | Conexión Prisma para migraciones | Directa, sin pooler |
| `JWT_SECRET` | Firma de tokens JWT | Generado aleatoriamente en este entorno; rotar antes de producción |
| `JWT_EXPIRES_IN` | Expiración del JWT | Actualmente `1d` |
| `PORT` | Puerto HTTP del backend | Opcional, por defecto `3000` |

`mobile/` no usa `.env` actualmente — la URL de la API está hardcodeada en `src/lib/api.ts` (`http://localhost:3000`).

## Dependencias instaladas

**`api/` (producción)**
`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/jwt`, `@prisma/client`, `prisma` (6.19.3), `bcrypt`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`.

**`api/` (desarrollo)**
`@nestjs/cli`, `@nestjs/mau`, `@nestjs/schematics`, `@nestjs/testing`, `@types/bcrypt`, `@types/express`, `@types/node`, `@types/supertest`, `@vitest/coverage-v8`, `oxlint`, `oxlint-tsgolint`, `prettier`, `source-map-support`, `supertest`, `typescript`, `vite-tsconfig-paths`, `vitest`.

**`mobile/` (producción)**
`expo` (~57.0.24), `expo-router`, `expo-secure-store`, `expo-constants`, `expo-linking`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-screens`, `react` (19.2.3), `react-dom`, `react-native` (0.86.3), `react-native-web`.

**`mobile/` (desarrollo)**
`@types/react`, `eslint`, `eslint-config-expo`, `typescript`.

**Plugins de Claude Code (nivel de máquina, no versionados en el repo)**
`claude-mem@thedotmack` (memoria persistente entre sesiones, runtime `worker` local, endurecido: telemetría e integraciones Telegram/Grok-bot/CCS-align deshabilitadas). `figma@claude-plugins-official` (sin relación con GymIA).

## Pendientes prioritarios

1. **Restringir CORS** — actualmente `app.enableCors()` acepta cualquier origen; fijar allowlist antes de cualquier despliegue.
2. **Manejo de expiración de JWT en mobile** — no hay refresh token ni interceptor que detecte un `401` por token expirado y fuerce logout/relogin.
3. **Tests automatizados de `AuthService`/`AuthController`** — Vitest está configurado pero no hay specs para register/login (casos éxito, duplicado, credenciales inválidas).
4. **Rate limiting en `/auth/*`** — sin protección contra fuerza bruta en login.
5. **Recuperación de contraseña y verificación de email** — no implementadas.
6. **Prueba en simulador/dispositivo real (iOS/Android)** — el flujo solo se verificó en navegador (web); falta validar SecureStore nativo y builds de EAS.
7. **Funcionalidad de producto** — más allá de auth, no hay pantallas ni endpoints de negocio (entrenamientos, seguimiento, etc.); `HomeScreen` es un placeholder.
8. **Config/env en mobile** — mover la URL base de la API a una variable de entorno (`app.config.ts` + `EXPO_PUBLIC_API_URL`) en vez de hardcodearla, para poder apuntar a staging/producción.
9. **CI/CD y despliegue** — sin pipeline definido para `api/` ni builds EAS para `mobile/`.
10. **Observabilidad** — sin logging estructurado ni tracking de errores (Sentry u otro) en ninguno de los dos proyectos.
