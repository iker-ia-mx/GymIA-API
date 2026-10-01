# GymIA · Plan de despliegue del API a producción (beta cerrada)

## Recomendación: Render, región Ohio, plan Starter

| Criterio                              | Render                                     | Railway                                  | Fly.io                               |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------- | ------------------------------------ |
| Coste API (512 MB, siempre encendido) | **USD 7/mes** fijo (workspace Hobby USD 0) | ~USD 5–10/mes por uso (mín. USD 5 Hobby) | ~USD 2,44/mes (shared-cpu-1x 512 MB) |
| Co-ubicación con Supabase us-east-2   | **Ohio = us-east-2** (latencia DB ~1–2 ms) | us-east (Virginia) ~10 ms                | iad (Virginia) ~10 ms                |
| Listo en este repo                    | **`render.yaml` ya escrito**               | requiere config en panel                 | requiere Dockerfile (no existe)      |
| Migraciones antes de arrancar         | `preDeployCommand`                         | pre-deploy command                       | `release_command`                    |
| Health check + zero-downtime          | sí (`/health`)                             | sí                                       | sí                                   |
| Coste predecible                      | **fijo**                                   | variable                                 | variable                             |

**Por qué Render:** el API hace ~5–10 queries por request de Coach; estar en la misma región AWS que Supabase importa más que USD 5. El coste es fijo (sin sorpresas en beta) y el blueprint ya existe y está validado contra el código (`/health`, `TRUST_PROXY`, `SIGTERM`). El plan Free de Render **no sirve**: se duerme tras 15 min y el primer request tarda ~50 s.

Escalar: Starter (0,5 CPU / 512 MB) aguanta holgadamente una beta de ≤200 usuarios (Nest en reposo usa ~120 MB). Si la memoria pasa de 400 MB sostenidos → Standard (USD 25).

## Coste mensual estimado (beta cerrada, 50–100 usuarios)

| Concepto                   | USD/mes        | Nota                                                                                                                           |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Render web service Starter | 7              | workspace Hobby USD 0                                                                                                          |
| Supabase                   | 0 → **25**     | Free pausa el proyecto tras 7 días sin actividad y no da backups descargables; **pasar a Pro antes de invitar usuarios**       |
| Anthropic (Haiku 4.5)      | 1,50–14        | medido USD 0,00094/mensaje; tope por usuario gratuito 5/día ⇒ máx. USD 0,14/usuario/mes; uso realista 1–2/día ⇒ ~USD 0,03–0,06 |
| Apple Developer            | ~8,25          | USD 99/año (necesario para TestFlight)                                                                                         |
| EAS Build                  | 0              | plan Free (cola más lenta)                                                                                                     |
| Dominio (opcional)         | ~1             |                                                                                                                                |
| **Total**                  | **~USD 42–55** | sin dominio ni Google Play (USD 25 único)                                                                                      |

## Variables de entorno (Render → Environment)

Valores fijos (ya en `render.yaml`): `NODE_VERSION=22`, `NODE_ENV=production`, `TRUST_PROXY=1`, `LLM_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-haiku-4-5`, `ANTHROPIC_TIMEOUT_MS=15000`, `COACH_FREE_DAILY_LIMIT=5`, `JWT_EXPIRES_IN=1d`, `SUPABASE_STORAGE_BUCKET=progress-photos`.

Secretos (marcados `sync: false`, se piden al crear el servicio):

| Variable                    | Obligatoria | Valor                                                                                                                                |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`              | sí          | pooler Supabase puerto **6543** `?pgbouncer=true&connection_limit=5`                                                                 |
| `DIRECT_URL`                | sí          | Supabase puerto **5432** (lo usa `migrate deploy`)                                                                                   |
| `JWT_SECRET`                | sí          | **nuevo**, distinto al de desarrollo: `openssl rand -base64 48`                                                                      |
| `ANTHROPIC_API_KEY`         | sí          | clave **nueva** de producción en console.anthropic.com con límite de gasto mensual (p. ej. USD 30)                                   |
| `SUPABASE_URL`              | sí          | `https://<ref>.supabase.co`                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY` | sí          | Dashboard → Settings → API                                                                                                           |
| `CORS_ORIGIN`               | no          | la app nativa no usa CORS; si queda vacío se permiten solo orígenes localhost de desarrollo (inofensivo). Definir solo si sirves web |
| `COACH_UNLIMITED_EMAILS`    | no          | tu correo y testers internos, separados por coma                                                                                     |
| `PORT`                      | no          | Render lo inyecta                                                                                                                    |

## Pasos

1. Merge de `prebeta` a `main` con CI verde (ver `PRE_BETA_COMMIT_PLAN.md`).
2. Supabase validado (ver `SUPABASE_COACH_VALIDATION.md`), incluido RLS, y plan Pro activo.
3. Render → New → **Blueprint** → repo `GymIA-API` → detecta `render.yaml` → rellenar secretos → Apply.
4. Primer deploy: build (`npm ci && npx prisma generate && npm run build`) → pre-deploy (`npx prisma migrate deploy`) → start (`node dist/main`) → health check `/health`.
5. Smoke test:

```bash
API=https://gymia-api.onrender.com
curl -s $API/health                     # {"status":"ok","database":"up",...}
curl -s -X POST $API/auth/register -H 'content-type: application/json' -d '{"email":"smoke+1@gymia.test","password":"Smoke-test-123"}'
# login → token → GET /coach/chat → quota {limit:5, remaining:5}
```

6. Mobile: sustituir en `eas.json` las URLs placeholder por `https://gymia-api.onrender.com` → `eas build --profile preview` → TestFlight.
7. Monitoreo mínimo: Render → Notifications (deploy fallido / health check), y un monitor externo gratuito (UptimeRobot) a `/health` cada 5 min. Alarma de gasto en Anthropic Console.

## Rollback

Render → Deploys → _Rollback_ al deploy anterior (instantáneo). Las migraciones son aditivas: el código anterior funciona con el esquema nuevo. Nunca revertir migraciones a mano en producción.

## Pendiente antes de abrir la beta pública (no bloquea beta cerrada)

- Throttler en memoria: correcto con 1 instancia; con >1 instancia mover a Redis.
- Errores: sin Sentry; los logs de Render (7 días en Hobby) son la única fuente. Añadir `@sentry/nestjs` (plan Free).
- La cuota diaria tiene una carrera teórica con requests simultáneos del mismo usuario (puede pasar a 6); irrelevante en coste.
