# GymIA · Validar el Coach (Anthropic) contra Supabase real

Todo se ejecuta **desde tu Mac** (ni la VM ni el contenedor de Claude alcanzan Supabase). Duración: ~10 min. Coste Anthropic: ~USD 0,005.

Ya validado sin Supabase (Postgres limpio + Anthropic real, mismo script sin modificar): 5 respuestas LLM + 6.º mensaje por `daily_limit`, 1 Conversation, 13 Message, `providerMeta` en 5, 3.180 tokens entrada / 308 salida, **USD 0,00472 total (USD 0,00094/mensaje)**. Falta repetirlo en tu proyecto real.

## 1. Preflight (sin tocar nada)

```bash
cd ~/GymIA/api
node -v                                   # v22.x
grep -cE '^(DATABASE_URL|DIRECT_URL|ANTHROPIC_API_KEY|JWT_SECRET)=.+' .env   # debe dar 4
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | sed -E 's#//[^@]+@#//***@#'      # sin mostrar contraseña
```

Esperado: `DATABASE_URL` → puerto **6543** con `?pgbouncer=true`; `DIRECT_URL` → puerto **5432**. `LLM_PROVIDER=anthropic`.

## 2. Respaldo

Supabase Dashboard → Database → Backups: confirma que existe un backup diario reciente (plan Free no tiene PITR). Si quieres uno manual:

```bash
pg_dump "$(grep '^DIRECT_URL=' .env | cut -d= -f2- | tr -d '"')" -Fc -f ~/gymia_backup_$(date +%F).dump
```

## 3. Migraciones

```bash
npx prisma migrate status
```

- _"Database schema is up to date"_ → salta al paso 4.
- _"Following migrations have not yet been applied"_ (esperado: hasta 6, de `20260925134032…` a `20260930175057…`) →

```bash
npx prisma migrate deploy
npx prisma migrate status   # ahora debe decir up to date
```

- _"drift detected"_ o error de historial → **para**. No ejecutes `migrate dev` ni `reset` contra Supabase (borra datos). Mándame la salida.

Las migraciones son solo `CREATE TABLE` / `ADD COLUMN` / índices: aditivas, no tocan datos existentes.

## 4. Prueba real end-to-end

```bash
npm run build && npm run verify:coach
```

Salida esperada (valores aproximados):

- `✓ migraciones del Coach aplicadas`
- 5 respuestas en español, ≤3 frases, sin markdown/emojis, `provider=anthropic`
- 6.º mensaje: `fallback daily_limit` respondido por el motor
- Conteos: Conversation 1 · Message 12–13 · providerMeta con tokens en 5
- Tokens ~3.000–3.500 entrada / ~250–400 salida · coste ~USD 0,004–0,006
- `EXIT 0` y usuario de prueba borrado

Si falla: `clave AUSENTE` → `.env`; `P1001` → URL/red; `provider_error` con `status 401` → clave inválida; `status 429/529` → reintentar más tarde.

## 5. Verificación directa en Supabase (SQL Editor)

El script borra su usuario al terminar; estas consultas sirven para tráfico real (tú usando la app).

**5.1 providerMeta de los últimos mensajes del coach**

```sql
select m."createdAt", m."providerName",
       m."providerMeta"->>'model'          as model,
       (m."providerMeta"->>'inputTokens')::int  as input_tokens,
       (m."providerMeta"->>'outputTokens')::int as output_tokens,
       (m."providerMeta"->>'costUsd')::numeric  as cost_usd,
       m."providerMeta"->>'fallback'       as fallback,
       m."providerMeta"->>'reason'         as fallback_reason,
       left(m.content, 80)                 as reply
from "Message" m
where m.role = 'assistant'
order by m."createdAt" desc
limit 20;
```

Esperado: `providerName = anthropic`, `model = claude-haiku-4-5…`, tokens > 0, `fallback = false`. Las respuestas por límite muestran `providerName` nulo y `fallback_reason = daily_limit`.

**5.2 Coste y tokens por día**

```sql
select date_trunc('day', "createdAt") as dia,
       count(*) filter (where "providerMeta"->>'fallback' = 'false') as respuestas_llm,
       count(*) filter (where "providerMeta"->>'fallback' = 'true')  as fallbacks,
       sum(("providerMeta"->>'inputTokens')::int)  as input_tokens,
       sum(("providerMeta"->>'outputTokens')::int) as output_tokens,
       round(sum(("providerMeta"->>'costUsd')::numeric), 6) as coste_usd
from "Message"
where role = 'assistant' and "createdAt" > now() - interval '30 days'
group by 1 order by 1 desc;
```

**5.3 Integridad Conversation ↔ Message**

```sql
select c.id, u.email, c."startedAt", c."lastMessageAt",
       count(m.*) as mensajes,
       count(m.*) filter (where m.role = 'user') as de_usuario
from "Conversation" c
join "User" u on u.id = c."userId"
left join "Message" m on m."conversationId" = c.id
group by c.id, u.email order by c."lastMessageAt" desc limit 10;

-- huérfanos (debe dar 0)
select count(*) from "Message" m
left join "Conversation" c on c.id = m."conversationId" where c.id is null;
```

**5.4 Fallbacks por motivo (salud del proveedor)**

```sql
select "providerMeta"->>'reason' as motivo, "providerMeta"->>'status' as http_status, count(*)
from "Message"
where role = 'assistant' and "providerMeta"->>'fallback' = 'true'
  and "createdAt" > now() - interval '7 days'
group by 1, 2 order by 3 desc;
```

`provider_error` > 5 % de respuestas → revisar logs (`coach_llm_error`).

**5.5 Seguridad: RLS y acceso `anon` (bloqueador si falla)**
La app usa Prisma con el rol `postgres`; nada debería ser legible por la API REST pública de Supabase.

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

select table_name, grantee, string_agg(privilege_type, ',') as privs
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1;
```

Si `rowsecurity = false` en alguna tabla **y** `anon` tiene privilegios, cualquiera con la anon key lee esos datos. Corrección (no afecta a Prisma, que usa `postgres`):

```sql
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
```

(Sin políticas = denegado para `anon`/`authenticated`; `postgres` y `service_role` siguen pasando.) Repite la primera consulta: todo `true`.

## 6. Criterio de aprobado

- [ ] `migrate status` up to date
- [ ] `verify:coach` EXIT 0
- [ ] 5.1 muestra model, tokens y costUsd
- [ ] 5.3 sin huérfanos
- [ ] 5.5 todas las tablas con RLS
