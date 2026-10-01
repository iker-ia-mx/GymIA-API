# Escuadrón — Arquitectura Técnica del Aislamiento por `userId`

**Fecha:** 2026-09-25
**Fuente:** `docs/ESCUADRON_PRODUCT_SPEC.md` (riesgo #1), `docs/SUENO_ESCUADRON_DECISIONS.md` (política de privacidad aprobada), `prisma/schema.prisma` y los módulos ya construidos (`workouts`, `evolution`, `nutrition`, `sleep`, `onboarding`) como referencia de convenciones reales del proyecto. Este documento es **solo diseño** — no se implementó nada, no hay commits. Resuelve el único bloqueador técnico pendiente antes de construir Escuadrón: cómo exponer datos de un usuario a sus compañeros de equipo sin romper el modelo de aislamiento que protege a todos los demás módulos.

---

## 1. Cómo romper el aislamiento actual por `userId`

### 1.1 Qué es realmente el aislamiento hoy (hallazgo, no suposición)

Se revisaron los 6 módulos ya construidos (`workouts`, `evolution`, `body-composition`, `nutrition`, `sleep`, `onboarding`) y todos siguen el mismo patrón, sin excepción:

```typescript
// Ejemplo real: EvolutionService.getStrengthOverview (evolution.service.ts:92)
async getStrengthOverview(userId: string) { ... }

// Ejemplo real: WorkoutsService.getRoutines (workouts.service.ts:29)
async getRoutines(userId: string) { ... }
```

Y cada controller llama a estos métodos así, siempre:

```typescript
@Get('...')
algunEndpoint(@CurrentUser() user: AuthenticatedUser) {
  return this.algunService.algunMetodo(user.id, ...); // siempre user.id del JWT
}
```

**Hallazgo importante:** el aislamiento **no es una garantía estructural** — ni de la base de datos (no hay Row-Level Security de Postgres configurada), ni de los servicios (`getStrengthOverview(userId: string)` acepta *cualquier* string, no verifica que corresponda al usuario autenticado). Es una **convención de los controllers**: siempre pasan `user.id` extraído del JWT vía `@CurrentUser()`, nunca un ID que venga del cliente. Nada a nivel de tipos ni de base de datos impide, hoy, que un desarrollador llame `evolutionService.getStrengthOverview('otro-user-id')` por error — simplemente nadie lo hace porque ningún controller lo permite.

Esto no es una debilidad a corregir — es, de hecho, la propiedad que hace posible construir Escuadrón de forma segura sin tocar ningún módulo existente (ver 1.3).

### 1.2 Principio de diseño: una sola costura, no aflojar el resto

**No se toca el aislamiento de ningún módulo existente.** En vez de eso, se introduce **una única costura explícita y auditable** — un guard que es el *único* punto de todo el backend autorizado a permitir una lectura entre usuarios distintos:

```typescript
// src/squad/squad-access.service.ts (nuevo, dentro del propio módulo Escuadrón)
@Injectable()
export class SquadAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Único método de todo el backend que autoriza cruzar la frontera de
  // userId. Si no hay membresía activa compartida, lanza — no hay camino
  // alternativo. Se verifica en cada request, nunca se cachea: salir de un
  // escuadrón revoca la visibilidad de inmediato (ver §8).
  async assertSharedSquad(requestingUserId: string, targetUserId: string): Promise<string> {
    if (requestingUserId === targetUserId) {
      const own = await this.prisma.squadMembership.findFirst({ where: { userId: requestingUserId } });
      if (!own) throw new ForbiddenException('No perteneces a ningún escuadrón');
      return own.squadId;
    }

    const shared = await this.prisma.squadMembership.findFirst({
      where: {
        userId: requestingUserId,
        squad: { members: { some: { userId: targetUserId } } },
      },
      select: { squadId: true },
    });
    if (!shared) {
      throw new ForbiddenException('No compartes un escuadrón con este usuario');
    }
    return shared.squadId;
  }
}
```

Todo endpoint de Escuadrón que necesite datos de *otro* usuario llama a `assertSharedSquad` **primero**, y solo después reutiliza los métodos de servicio que ya existen (`EvolutionService.getStrengthOverview(targetUserId)` para PRs, cálculo de adherencia/rachas sobre `WorkoutSession` para el `targetUserId`, etc.) — sin modificar ni un solo archivo de `evolution/`, `workouts/`, `nutrition/`, `body-composition/`. Esos módulos siguen siendo 100% de un solo usuario, exactamente como hoy; Escuadrón es el único *consumidor* que, con permiso verificado, los llama con un ID ajeno.

**Por qué esta es la opción correcta para el MVP** (comparada con las alternativas):

| Alternativa | Por qué no, para el MVP |
|---|---|
| Row-Level Security de Postgres (políticas `CREATE POLICY` que filtren por `squadId` a nivel de base de datos) | Más robusto en profundidad, pero requiere configurar `SET LOCAL` con el `userId` en cada conexión de Prisma, migrar todas las políticas existentes, y no hay nada parecido hoy en el proyecto. Correcto para v1.1 como capa adicional, no como primer paso — ver §7 |
| Tablas de snapshot materializado (`SquadMemberSnapshot` actualizada por un job) | Evita tocar las tablas en vivo, pero introduce datos obsoletos (¿cada cuánto se recalcula?) y un job/cron nuevo que este proyecto no tiene infraestructura para correr todavía | 
| Aflojar el aislamiento en los servicios existentes (ej. agregar un parámetro `viewerId` a `EvolutionService`) | Contamina 6 módulos ya probados y estables con lógica de autorización que no les pertenece — el radio de error crece de "un módulo nuevo" a "todo el backend" |

### 1.3 Regla operativa (para que quede como estándar del proyecto)

**Ningún método de ningún servicio existente cambia de firma ni de comportamiento.** El único código nuevo con permiso para pasar un `userId` que no es el del JWT es el que vive dentro de `src/squad/`, y siempre después de una llamada exitosa a `assertSharedSquad`. Esta regla debe quedar anotada como comentario en `SquadAccessService` (ya está arriba) y se recomienda añadirla a `CLAUDE.md` cuando se implemente (fuera del alcance de este documento).

---

## 2. Nuevos modelos Prisma necesarios

Siguiendo la convención ya usada en todo el proyecto (migraciones aditivas, FK directa a `userId`/`squadId`, sin `enum` de Prisma — el proyecto usa siempre `String` con valores documentados en comentario y validados por `class-validator`, ver `OnboardingProfile.goal`, `Meal.mealType`, `SleepSession.source`):

### 2.1 Modelos del MVP (ver §9)

```prisma
// Escuadrón — identidad de equipo. `inviteCode` es el único mecanismo de
// unión del MVP (sin aprobación, ver SquadJoinRequest en §2.2 para v1.1).
model Squad {
  id          String   @id @default(uuid())
  name        String
  isPrivate   Boolean  @default(false)
  inviteCode  String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members Squad Membership[]
  posts   SquadPost[]

  @@index([inviteCode])
}

// Membresía — la tabla puente real entre User y Squad. Un usuario solo
// puede pertenecer a un escuadrón a la vez en el MVP (no se decidió
// multi-escuadrón; @@unique([userId]) lo hace explícito, no implícito).
model SquadMembership {
  id       String   @id @default(uuid())
  userId   String   @unique
  squadId  String
  role     String // "lider" | "miembro"
  xp       Int      @default(0)
  streakDays Int    @default(0)
  joinedAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  squad Squad @relation(fields: [squadId], references: [id], onDelete: Cascade)

  @@index([squadId])
}

// Post del feed. `visibility` reservado para cuando exista más de un nivel
// (hoy todo post es visible a todo el escuadrón, sin sub-audiencias).
model SquadPost {
  id        String   @id @default(uuid())
  squadId   String
  authorId  String
  type      String // "entrenamiento" | "comida" | "progreso" (política de privacidad, ver §8)
  text      String
  createdAt DateTime @default(now())

  squad  Squad         @relation(fields: [squadId], references: [id], onDelete: Cascade)
  author User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  likes  SquadPostLike[]

  @@index([squadId])
  @@index([squadId, createdAt])
}

model SquadPostLike {
  id     String @id @default(uuid())
  postId String
  userId String

  post SquadPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
}
```

### 2.2 Modelos de v1.1 (documentados, NO se crean en el MVP)

```prisma
// v1.1 — invitación dirigida a una persona específica (hoy el MVP solo
// tiene unión instantánea por código, sin este concepto).
model SquadInvite {
  id          String   @id @default(uuid())
  squadId     String
  invitedById String
  contactRef  String // teléfono/email hasheado — ver riesgo de contactos en ESCUADRON_PRODUCT_SPEC.md §15.3
  status      String // "pendiente" | "aceptada" | "rechazada"
  createdAt   DateTime @default(now())
}

// v1.1 — solicitud de unión con aprobación (el MVP no tiene aprobación,
// unirse por código es instantáneo).
model SquadJoinRequest {
  id        String   @id @default(uuid())
  squadId   String
  userId    String
  status    String // "pendiente" | "aceptada" | "rechazada"
  createdAt DateTime @default(now())
}

// v1.1 — Retos y Eventos, Administrar Escuadrón completo (permisos
// granulares, moderación IA — gap de IA ya documentado).
model SquadChallenge { /* ver docs/ESCUADRON_PRODUCT_SPEC.md §7 */ }
model SquadEvent     { /* ver docs/ESCUADRON_PRODUCT_SPEC.md §7 */ }
model SquadAchievement { /* pospuesto también para Perfil, S4-ProgressAchievements */ }
```

### 2.3 Cambio necesario en `User`

```prisma
model User {
  // ...campos existentes sin cambios...
  squadMembership SquadMembership?
  squadPosts      SquadPost[]
  squadPostLikes  SquadPostLike[]
}
```

Aditivo puro — no se toca ninguna columna existente de `User`, consistente con la regla de `CLAUDE.md` de no alterar esa tabla sin confirmación explícita (esto no la altera, solo agrega relaciones inversas, que no generan columnas nuevas en `User`).

---

## 3. Relaciones entre User / Squad / SquadMember / Invitaciones / Roles

```
User (1) ──── (0..1) SquadMembership (*) ──── (1) Squad
                    │
                    └── role: "lider" | "miembro"  (string, no Prisma enum — mismo patrón que el resto del proyecto)

Squad (1) ──── (*) SquadPost ──── (*) SquadPostLike ──── (1) User

[v1.1] Squad (1) ──── (*) SquadInvite ──── (1) User (invitedById)
[v1.1] Squad (1) ──── (*) SquadJoinRequest ──── (1) User
```

**Decisiones de cardinalidad explícitas (no implícitas):**
- **Un usuario, un escuadrón a la vez** (`SquadMembership.userId` es `@unique`, no una lista). No se decidió multi-escuadrón en ninguna spec aprobada — si se quiere permitir después, es un cambio de esquema deliberado, no una casualidad del diseño actual.
- **Roles son 2, no una jerarquía de 3** (`docs/ESCUADRON_PRODUCT_SPEC.md` mencionaba Líder/Co-Líder/Miembro; el MVP aprobado en `docs/SUENO_ESCUADRON_DECISIONS.md` dice "roles Líder/Miembro" — Co-Líder queda para v1.1, junto con "Administrar Escuadrón completo").
- **`SquadPostLike` es la única relación N:N real** del MVP (usuario↔post) — todo lo demás es 1:N.

---

## 4. Cambios de backend requeridos

1. **Migración Prisma aditiva** con los 4 modelos del MVP (§2.1) + relaciones inversas en `User`.
2. **Nuevo módulo `SquadModule`** (`src/squad/`), mismo patrón de un controller que agrupa el dominio (como `NutritionController`), con secciones:
   - `// ---- Squad (crear/unirse/salir) ----`: `POST /squads` (crear, genera `inviteCode`), `POST /squads/join` (body: `inviteCode`), `POST /squads/leave`, `GET /squads/me` (mi escuadrón, o `null`).
   - `// ---- Members ----`: `GET /squads/me/members` (lista con XP/racha — dato propio del `SquadMembership`, no requiere `assertSharedSquad` para el listado general porque el propio membership del que pregunta ya lo autoriza — ver nota abajo), `GET /squads/members/:userId` (perfil de un miembro — **este sí llama a `SquadAccessService.assertSharedSquad` primero**, y agrega PRs vía `EvolutionService.getStrengthOverview(targetUserId)` reutilizado sin modificar).
   - `// ---- Feed ----`: `POST /squads/posts`, `GET /squads/posts`, `POST /squads/posts/:id/like`, `DELETE /squads/posts/:id/like`.
3. **`SquadAccessService`** (§1.2) como provider del módulo, inyectado donde se necesite verificar frontera de usuario.
4. **DTOs** con `class-validator`, mismo patrón que el resto (`CreateSquadDto`, `JoinSquadDto`, `CreateSquadPostDto`).
5. **Cálculo de XP y rachas** — no existe hoy ni a nivel individual. Fórmula transparente propuesta para el MVP (mismo principio ya usado por `progressScore` en `EvolutionService`, no "IA real"): `xp = workoutSessions completadas × 10 + PRs logrados × 25` (constantes ilustrativas, a definir en implementación); `streakDays` reutiliza el mismo concepto que ya se documentó como gap en `evolucion-error-adherencia` — **este documento no resuelve esa fórmula de racha**, solo señala que Escuadrón la necesita (dependencia ya anotada en `docs/FIGMA_TO_APP_MASTER_PLAN.md` §4).
6. **Tests**: unitarios de `SquadAccessService.assertSharedSquad` (caso propio, caso compartido, caso sin relación → `ForbiddenException`) y de `SquadService` con Prisma mockeado, mismo patrón que `nutrition.service.spec.ts`/`sleep.service.spec.ts`.

**Nota sobre `GET /squads/me/members`:** listar a *todos* los miembros de *mi propio* escuadrón no requiere `assertSharedSquad` por cada uno — mi propia membresía ya prueba que pertenezco a ese `squadId`, así que un solo `findMany({ where: { squadId: miSquadId } })` es seguro y evita N verificaciones redundantes. `assertSharedSquad` se reserva para cuando se pide el **detalle enriquecido** de un miembro específico (que sí toca `EvolutionService`/`WorkoutsService` de otro usuario).

---

## 5. Cambios de mobile requeridos

1. **Nuevo grupo de rutas** `src/app/(app)/escuadron/` (patrón `_layout.tsx` con `<Stack>`, igual que `nutricion/`, `sueno/`, `entrenar/`, `perfil/`):
   - `crear.tsx` — adaptado de los campos de "Administrar Escuadrón" (ver `docs/SUENO_ESCUADRON_DECISIONS.md` §3).
   - `unirse.tsx` o integrado en el estado vacío — código de invitación.
   - `index.tsx` — Hub simplificado (nombre, XP/racha propios, atajo a Miembros/Feed).
   - `miembros.tsx` — lista de `GET /squads/me/members`.
   - `miembro/[userId].tsx` — perfil de miembro (`GET /squads/members/:userId`), con Adherencia/Rachas/PRs visibles (política aprobada, ver §8).
   - `feed.tsx` + composer de post (texto + tipo, sin multimedia en el MVP).
2. **Nuevo cliente API** `src/lib/squadApi.ts`, mismo patrón que `sleepApi.ts`/`nutritionApi.ts`.
3. **Navegación**: sin tab propio todavía (Alternativa 2 vigente) — acceso desde una sección/atajo en `perfil/index.tsx`, igual que se hizo para "Objetivos y Preferencias".
4. **Estado vacío "sin escuadrón todavía"**: reutiliza `SystemStateScreen` (ya existe, usado 11 veces), con 2 CTAs (Crear / Unirse) — sin componente nuevo que inventar.
5. **Componente compartido nuevo**: una fila de "miembro" (avatar/inicial + nombre + rol + XP/racha), reutilizada en Hub (ranking) y Miembros — candidato a extraerse a `src/components/`, mismo criterio que ya se usó para `SystemStateScreen`.

---

## 6. Estrategia de migración

- **100% aditiva.** No se modifica ninguna tabla existente más allá de agregar relaciones inversas en `User` (que no generan columnas). Ninguna migración de datos: Escuadrón parte de cero, no hay filas que transformar ni backfill que correr.
- **Sin flag de feature necesario a nivel de backend** — los endpoints nuevos simplemente no existen hasta que se despliegan; no hay riesgo de exponer código a medio construir porque Nest solo registra las rutas del módulo una vez importado en `AppModule`.
- **Orden de despliegue recomendado:** (1) migración Prisma, (2) backend completo con tests verdes, (3) mobile — en ese orden, igual que se hizo para Sueño y Nutrición en este mismo proyecto.
- **Reversión:** si algo sale mal, `DROP` de las 4 tablas nuevas no afecta a ningún otro módulo — es la ventaja directa de que la migración sea puramente aditiva y aislada.

---

## 7. Riesgos

1. **Olvidar `assertSharedSquad` en un endpoint nuevo.** Es el riesgo real de toda esta arquitectura: si alguien agrega un endpoint a `SquadController` que use un `userId` de otro usuario sin pasar por el guard primero, hay una fuga de datos. Mitigación propuesta: todo método de `SquadService` que reciba dos IDs de usuario distintos debe empezar literalmente con `await this.squadAccess.assertSharedSquad(...)` como primera línea — convención a reforzar en code review, y candidato a un test de integración que recorra todos los endpoints del controller e intente acceder con un usuario sin escuadrón compartido, esperando 403 en todos.
2. **N+1 al construir el ranking del Hub.** Si el Hub necesita XP/racha de todos los miembros, un `findMany` con `include` es suficiente (datos ya están en `SquadMembership`, no requieren tocar otros módulos) — no hay riesgo de N+1 aquí porque XP/racha se guardan directamente en `SquadMembership`, no se recalculan on-the-fly desde `WorkoutSession` en cada lectura del Hub (eso sí sería costoso). El perfil de miembro individual (con PRs) sí hace una llamada adicional a `EvolutionService`, pero es 1 por vista de perfil, no N.
3. **Row-Level Security como deuda técnica, no como bloqueador.** La arquitectura de §1 es correcta y suficiente para el MVP, pero es una autorización a nivel de aplicación, no de base de datos — un bug futuro en un query raw (`$queryRaw`) podría saltarse el guard si alguien lo escribe sin pasar por `SquadService`. Recomendado como hardening de v1.1, no como requisito de MVP.
4. **Actualización de XP/racha desincronizada.** Si el cálculo de XP se hace en el momento de leer (no al escribir), cualquier cambio a la fórmula requiere recalcular todo; si se hace al escribir (ej. al completar una `WorkoutSession`), requiere enganchar un hook en `WorkoutsService` — que es exactamente el tipo de acoplamiento que §1.2 quiere evitar. Recomendación: para el MVP, calcular XP/racha de forma diferida (un endpoint `POST /squads/me/recompute` que el cliente llama tras completar una sesión, o un cron simple) en vez de acoplar `WorkoutsService` a Escuadrón — mantiene la costura única.
5. **Tamaño del cambio sigue siendo grande**, ya señalado en `docs/ESCUADRON_PRODUCT_SPEC.md` §15.8 — este documento resuelve el riesgo arquitectónico #1, no reduce el alcance total del módulo.

---

## 8. Impacto en seguridad y privacidad

Aplica directamente la política ya aprobada en `docs/SUENO_ESCUADRON_DECISIONS.md` §3, ahora expresada como reglas de autorización concretas:

| Dato | Regla de autorización |
|---|---|
| Adherencia, Rachas, PRs | Visibles a cualquier usuario que pase `assertSharedSquad` — **sin excepción ni opt-out** (decisión aprobada explícitamente, no un defecto de diseño) |
| Progreso corporal, Nutrición | **Nunca** expuestos por `assertSharedSquad` — el único camino de visibilidad es un `SquadPost` que el propio usuario decidió publicar explícitamente. No existe ningún endpoint de Escuadrón que lea `BodyMetric`, `ProgressPhoto` ni `Meal` directamente de otro usuario |

**Revocación inmediata al salir del escuadrón:** como `assertSharedSquad` consulta `SquadMembership` en cada request (no hay caché ni token de sesión con permisos embebidos), el momento en que un usuario sale de un escuadrón (`SquadMembership` eliminada), dejar de compartir membresía activa **inmediatamente** revoca cualquier visibilidad cruzada, sin necesidad de invalidar tokens ni limpiar cachés — una propiedad directa de verificar en vivo en vez de usar snapshots.

**Superficie nueva de PII:** el feed (`SquadPost`) puede contener texto libre escrito por usuarios, visible a todo el escuadrón — mismo tipo de superficie que cualquier red social simple. Sin moderación real en el MVP (gap de IA ya documentado en la spec de producto) — se recomienda al menos una función de "reportar publicación" simple (marcar + ocultar para el reportante, sin IA) como mínimo de higiene, a evaluar si entra en el MVP o v1.1.

**Contactos del dispositivo:** fuera del MVP (ver `docs/ESCUADRON_PRODUCT_SPEC.md` §15.3) — este documento no propone nada nuevo al respecto, sigue siendo v1.1.

---

## 9. MVP recomendado (técnico, alineado con el MVP de producto ya aprobado)

Exactamente lo aprobado en `docs/SUENO_ESCUADRON_DECISIONS.md` §4, ahora con el detalle técnico que faltaba:

- **Modelos:** `Squad`, `SquadMembership`, `SquadPost`, `SquadPostLike` (§2.1). `SquadInvite`/`SquadJoinRequest` quedan fuera (unión instantánea por código, sin aprobación).
- **Autorización:** `SquadAccessService.assertSharedSquad` como única costura (§1).
- **Endpoints:** crear/unirse/salir de escuadrón, listar miembros (propio squad, sin guard adicional), perfil de miembro individual (con guard), feed de posts (solo texto) + likes.
- **XP/rachas:** fórmula transparente, recalculada de forma diferida (no acoplada a `WorkoutsService`) — ver riesgo #4.
- **Mobile:** Crear, Unirse (por código), Hub, Miembros, Perfil de Miembro, Feed + Crear Publicación (texto only). Sin tab propio (Alternativa 2 vigente).
- **Explícitamente fuera:** Retos y Eventos, Administrar Escuadrón completo, invitación por contactos, búsqueda pública, insignias, RLS de Postgres, moderación de contenido.

---

## 10. Plan de implementación paso a paso

1. **Migración Prisma** — los 4 modelos del MVP + relaciones inversas en `User`. Verificar con `npx prisma migrate dev` contra la base real, igual que Nutrición y Sueño.
2. **`SquadAccessService` + tests** — implementar `assertSharedSquad` y escribir sus 3 casos (propio, compartido, sin relación) *antes* de escribir cualquier otro código de Escuadrón. Es la pieza de la que depende toda la seguridad del módulo.
3. **`SquadService` — crear/unirse/salir** — sin dependencias de otros módulos todavía. Tests con Prisma mockeado.
4. **`SquadService` — miembros y perfil individual** — aquí se integra `EvolutionService.getStrengthOverview(targetUserId)` por primera vez, siempre después de `assertSharedSquad`. Tests que verifiquen explícitamente que sin membresía compartida se lanza `ForbiddenException` antes de tocar `EvolutionService`.
5. **`SquadService` — feed y likes** — el resto del CRUD, sin lógica cross-user (los posts son del propio autor, visibles a todo el escuadrón por pertenencia, no por `assertSharedSquad` — un miembro ve el feed completo, no perfiles individuales de otros ahí).
6. **`SquadController` + DTOs** — exponer todo lo anterior, registrar `SquadModule` en `AppModule`.
7. **`tsc --noEmit`, lint, `vitest run`** — mismo checklist que Nutrición y Sueño antes de tocar mobile.
8. **Mobile: Crear/Unirse + estado vacío** — primer flujo end-to-end verificable (crear un escuadrón, ver el código, unirse con una segunda cuenta de prueba).
9. **Mobile: Hub + Miembros** — datos propios primero (sin riesgo de autorización).
10. **Mobile: Perfil de Miembro** — primer punto donde se ejercita `assertSharedSquad` desde la app real.
11. **Mobile: Feed + Crear Publicación** — cierra el MVP.
12. **Actualizar `FIGMA_TO_APP_MASTER_PLAN.md`** — recalcular paridad, marcar pantallas implementadas, documentar cualquier gap nuevo descubierto en el camino (mismo cierre que se hizo para Nutrición y Sueño).

Ningún paso de este plan requiere tocar `workouts/`, `evolution/`, `body-composition/`, `nutrition/` ni `sleep/` — la promesa central de §1.2 se sostiene de principio a fin.
