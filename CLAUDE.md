# GymIA API

NestJS backend for GymIA. Sibling project: `../mobile` (Expo/React Native app, see its own CLAUDE.md/AGENTS.md).

## Stack

- NestJS 12, ESM (`"type": "module"`), TypeScript with `moduleResolution: nodenext` — relative imports need explicit `.js` extensions.
- Prisma 6.19.3 as the only data layer, backed by Supabase Postgres. `DATABASE_URL` (pooled, pgbouncer) is used at runtime; `DIRECT_URL` (unpooled) exists for migrations. Never point the datasource at anything else without discussion.
- Auth: `bcrypt` (native) for password hashing, `@nestjs/jwt` for tokens, `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`) for env loading, `class-validator`/`class-transformer` with a global `ValidationPipe` for DTOs.
- Tests: Vitest (`vitest.config.ts` for unit, `vitest.config.e2e.ts` for e2e). Lint: `oxlint --type-aware`.

## Rules

- Do not reinstall or re-generate Prisma; the client is already generated and the `User` table already exists in Supabase — never run a migration that alters or drops it without explicit confirmation.
- Stay on Prisma 6.19.3. Do not upgrade to Prisma 8 (including RC/preview builds) without explicit confirmation.
- Never recreate tables that already exist (`User` and any future ones) — treat the live Supabase schema as source of truth.
- When delivering code changes, hand over complete files/functions, not partial diffs or snippets the user has to merge by hand.
- `PrismaModule` (`src/prisma/`) is `@Global()` — don't reimport it per-feature-module.
- New feature modules follow the `auth` module's shape: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/*.dto.ts` validated with `class-validator`.
- Secrets (`JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`) live only in `.env` (gitignored) — never hardcode or log them.
