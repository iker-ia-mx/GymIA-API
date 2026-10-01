# GymIA · Plan de commits pre-beta

Fecha: 2026-09-30 · Repos: `GymIA-API` (main @ 1306a6b) y `GymIA-Mobile-App` (main @ 598a453). Ambos `main` coinciden con `origin`: **todo lo descrito aquí existe solo en tu Mac**.

## 1. Auditoría

### API — estado sin commit

| Tipo                       | Archivos                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modificados (18)           | `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `prisma/schema.prisma`, `src/app.module.ts`, `src/main.ts`, `src/auth/{auth.controller,auth.service,auth.service.spec}.ts`, `src/evolution/{controller,module,service,service.spec}.ts`, `src/nutrition/{controller,service,service.spec}.ts`, `docs/FIGMA_TO_APP_MASTER_PLAN.md` |
| Migraciones sin commit (6) | `20260925134032_add_nutrition_recipes_and_schedule`, `20260925135838_add_sleep_mvp`, `20260925141617_add_squad_mvp`, `20260930173542_add_ai_decision`, `20260930174110_add_coach_chat`, `20260930175057_add_onboarding_timezone`                                                                                                                     |
| Módulos nuevos sin commit  | `src/adherence/*`, `src/sleep/*`, `src/squad/*`, `src/coach/*` (motor, chat, cuota, guard, pricing, 5 proveedores LLM), `src/health/*`                                                                                                                                                                                                               |
| DTOs nuevos                | `auth/dto/{change-password,delete-account}`, `nutrition/dto/{create-recipe,update-recipe,upsert-meal-schedule}`                                                                                                                                                                                                                                      |
| Infra nueva                | `.nvmrc`, `render.yaml`, `scripts/verify-coach-supabase.mjs`                                                                                                                                                                                                                                                                                         |
| Docs nuevos (11)           | `ACHIEVEMENTS_PRODUCT_SPEC`, `ADHERENCE_*` (2), `ESCUADRON_*` (2), `EVOLUTION_REMAINING_SPEC`, `FINAL_PARITY_PRIORITY`, `NEXT_PARITY_OPPORTUNITIES`, `ROADMAP_RECALCULATION`, `SLEEP_PRODUCT_SPEC`, `SUENO_ESCUADRON_DECISIONS`                                                                                                                      |
| Ignorado ahora             | `graphify-out/` (14 archivos generados)                                                                                                                                                                                                                                                                                                              |

**Hallazgo crítico:** `HEAD` no compila tal como está en tu disco a medias: `app.module.ts` y `schema.prisma` modificados referencian módulos y modelos que solo existen sin trackear. Un commit parcial (solo los `M`) rompe el build en CI y en Render.

### API — migraciones

- 6 migraciones locales no están en git. En Supabase **no se ha verificado** si están aplicadas (la VM/contenedor no alcanzan Supabase). Paso obligatorio: `npx prisma migrate status` desde tu Mac (ver `SUPABASE_COACH_VALIDATION.md`).
- Comparación esquema ↔ migraciones: 28 modelos, 0 tablas/columnas faltantes. Las migraciones se aplicaron limpias sobre Postgres vacío (validado).

### Mobile — estado sin commit

- 22 modificados, 8 borrados (rutas en inglés de `entrenar/` y `evolucion/strength`), 50 nuevos: rutas en español equivalentes, tabs `hoy/`, `sueno/`, `escuadron/`, 8 pantallas de nutrición, 6 de perfil, libs `coachApi`, `sleepApi`, `squadApi`, `healthKit`, y `eas.json`.
- **Los borrados y sus reemplazos deben ir en el mismo commit** o habrá un commit con rutas rotas.

### Lo que NO sobrevive a un clone limpio

| #   | Problema                                                                                          | Impacto                                                                        | Acción                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | `.env` no está en git (correcto)                                                                  | El API no arranca                                                              | Variables en Render (ver `DEPLOY_PRODUCTION.md`)         |
| 2   | Bucket `progress-photos` creado a mano en Supabase                                                | Fotos de progreso fallan en un proyecto nuevo                                  | Documentado; recrear manualmente si cambias de proyecto  |
| 3   | RLS de Supabase sin verificar                                                                     | Si `anon` tiene acceso a tablas `public`, la API REST de Supabase expone datos | Ejecutar SQL de la sección 4 de la guía de validación    |
| 4   | `init.sql` en la raíz está obsoleto (solo tabla `User`)                                           | Confunde: no es la fuente de verdad                                            | Borrarlo o marcarlo obsoleto en el commit de chore       |
| 5   | `postinstall: prisma skills sync` + 4 carpetas duplicadas `.agents/.claude/.cursor/.devin/skills` | Ruido; `                                                                       |                                                          | exit 0` evita fallo | Opcional: quitar del repo |
| 6   | `eas.json` con URLs `REEMPLAZAR-…example.com`                                                     | Builds de EAS apuntan a nada                                                   | Sustituir tras desplegar el API                          |
| 7   | `api.ts` del móvil cae a `localhost:3000` si falta `EXPO_PUBLIC_API_URL`                          | App de beta sin backend                                                        | Definir URL en perfiles de EAS                           |
| 8   | Sin `TRUST_PROXY` detrás de proxy                                                                 | Throttler limita a todos como una sola IP                                      | Ya implementado + documentado; `TRUST_PROXY=1` en Render |
| 9   | Node sin fijar                                                                                    | Builds con otra versión                                                        | Resuelto: `.nvmrc` = 22 y `engines`                      |
| 10  | Lockfile desincronizado                                                                           | `npm ci` fallaba                                                               | Resuelto: `npm ci --dry-run` OK                          |

## 2. Riesgos antes de hacer commit

1. **Secretos:** revisado — ningún archivo a commitear contiene claves (`sk-ant-`, JWT, `service_role` con valor). Antes de cada commit: `git diff --cached | grep -nE 'sk-ant-|eyJhbGci|service_role.*=.{20}'` debe salir vacío.
2. **CI corre en push a `main`** (npm ci → prisma generate → lint → build → test). Haz los commits en una rama `prebeta` y abre PR: CI valida el resultado final antes de tocar `main`.
3. **Commits intermedios no compilan por sí solos** si separas módulos de `app.module.ts`. El orden de abajo los deja compilables desde el commit 7; si quieres cada commit verde, sigue el orden exacto.
4. **Migraciones:** commitearlas no las aplica. Render las aplicará con `preDeployCommand` → si Supabase ya tiene alguna aplicada a mano con otro nombre, `migrate deploy` fallará. Verifica `migrate status` antes del primer deploy.
5. **`package-lock.json`** fue regenerado con `--package-lock-only`. Haz `npm ci` limpio en tu Mac antes de commitear para confirmar.
6. **Mobile:** renombres de rutas cambian deep links; si alguien tiene builds viejas no importa en beta cerrada.

## 3. Orden exacto de commits — API (rama `prebeta`)

```bash
cd ~/GymIA/api && git switch -c prebeta
```

| #   | Commit                                                                                      | Archivos                                                                             |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | `chore: pin node 22, sync lockfile, ignore graphify-out`                                    | `.nvmrc`, `.gitignore`, `package.json`, `package-lock.json`                          |
| 2   | `feat(db): recipes, sleep, squad, AI decision, coach chat, timezone`                        | `prisma/schema.prisma`, `prisma/migrations/20260925*`, `prisma/migrations/20260930*` |
| 3   | `feat(adherence): adherence engine`                                                         | `src/adherence/`                                                                     |
| 4   | `feat(sleep): sleep MVP`                                                                    | `src/sleep/`                                                                         |
| 5   | `feat(squad): squad MVP`                                                                    | `src/squad/`                                                                         |
| 6   | `feat(auth,evolution,nutrition): password change, account deletion, recipes, meal schedule` | `src/auth/`, `src/evolution/`, `src/nutrition/`                                      |
| 7   | `feat(coach): engine v0, LLM adapter, Anthropic provider, daily quota (DEC-014)`            | `src/coach/`                                                                         |
| 8   | `feat(health): /health endpoint, trust proxy, shutdown hooks`                               | `src/health/`, `src/main.ts`, `src/app.module.ts`                                    |
| 9   | `chore(deploy): render blueprint, env example, coach verification script`                   | `render.yaml`, `.env.example`, `scripts/verify-coach-supabase.mjs`                   |
| 10  | `docs: product specs and pre-beta plans`                                                    | `docs/`                                                                              |

Nota: `package.json` del commit 1 ya incluye `@anthropic-ai/sdk` y los scripts `verify:coach`, `prisma:deploy`, `start:prod`; es inofensivo antes de que exista el código.

Comandos (uno por fila):

```bash
git add .nvmrc .gitignore package.json package-lock.json && git commit -m "chore: pin node 22, sync lockfile, ignore graphify-out"
git add prisma/schema.prisma prisma/migrations && git commit -m "feat(db): recipes, sleep, squad, AI decision, coach chat, timezone"
git add src/adherence && git commit -m "feat(adherence): adherence engine"
git add src/sleep && git commit -m "feat(sleep): sleep MVP"
git add src/squad && git commit -m "feat(squad): squad MVP"
git add src/auth src/evolution src/nutrition && git commit -m "feat(auth,evolution,nutrition): password change, account deletion, recipes, meal schedule"
git add src/coach && git commit -m "feat(coach): engine v0, LLM adapter, Anthropic provider, daily quota (DEC-014)"
git add src/health src/main.ts src/app.module.ts && git commit -m "feat(health): /health endpoint, trust proxy, shutdown hooks"
git add render.yaml .env.example scripts/verify-coach-supabase.mjs && git commit -m "chore(deploy): render blueprint, env example, coach verification script"
git add docs && git commit -m "docs: product specs and pre-beta plans"
git status   # debe salir limpio (salvo init.sql si decides borrarlo aparte)
```

Verificación final antes del push:

```bash
rm -rf node_modules dist && npm ci && npx prisma generate && npm run lint && npm run build && npm test
git push -u origin prebeta   # abre PR → CI verde → merge a main
```

## 4. Orden exacto de commits — Mobile (rama `prebeta`)

| #   | Commit                                                             | Archivos                                                                                                                                                                    |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `chore: deps and app config`                                       | `package.json`, `package-lock.json`, `app.json`                                                                                                                             |
| 2   | `feat(lib): coach, sleep, squad, HealthKit clients`                | `src/lib/` (nuevos + `api.ts`, `evolutionApi.ts`, `nutritionApi.ts`)                                                                                                        |
| 3   | `refactor(routes): Spanish route names for entrenar/evolucion`     | borrados + `entrenar/*.tsx` nuevos + `evolucion/fuerza.tsx` + `entrenar/index.tsx`, `evolucion/index.tsx` (`git add -A "src/app/(app)/entrenar" "src/app/(app)/evolucion"`) |
| 4   | `feat: Hoy, Sueño and Escuadrón tabs`                              | `src/app/(app)/hoy`, `src/app/(app)/sueno`, `src/app/escuadron`, `src/app/(app)/_layout.tsx`, `src/app/_layout.tsx`, `src/theme/`                                           |
| 5   | `feat(nutricion): recipes, schedules, goals, privacy`              | `src/app/(app)/nutricion`                                                                                                                                                   |
| 6   | `feat(perfil): security, password, account deletion, integrations` | `src/app/(app)/perfil`, `src/app/(auth)/register.tsx`                                                                                                                       |
| 7   | `chore(eas): build profiles`                                       | `eas.json` — **después** de sustituir las URLs placeholder por la URL real de Render                                                                                        |

Verificación: `npx tsc --noEmit` (pasa hoy) y un arranque `npx expo start` contra el API desplegado.
