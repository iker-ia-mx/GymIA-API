import { randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EvolutionService } from '../evolution/evolution.service.js';
import { SquadAccessService } from './squad-access.service.js';
import { CreateSquadDto } from './dto/create-squad.dto.js';
import { CreateSquadPostDto } from './dto/create-squad-post.dto.js';
import { JoinSquadDto } from './dto/join-squad.dto.js';

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) — el código se
// comparte de viva voz o por mensaje, tiene que ser fácil de transcribir.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;

// Nombre para mostrar a OTROS miembros del escuadrón — nunca el email
// completo (deuda técnica ya señalada en 01.02 Auditoría backend:
// "Escuadrón expone emails de otros miembros"). User no tiene
// displayName en el esquema todavía, así que se deriva igual que ya hace
// el móvil para el avatar/saludo (email.split('@')[0]) — mismo criterio
// en los dos lados, sin inventar un dato nuevo.
function toDisplayName(email: string): string {
  return email.split('@')[0];
}

function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

// Servicios de Escuadrón: crear/unirse/salir, miembros, perfil enriquecido
// de un miembro, y feed (Etapa 3). Toda autorización cross-user o
// cross-squad pasa por SquadAccessService — este archivo nunca reimplementa
// un chequeo de pertenencia por su cuenta (docs/ESCUADRON_TECHNICAL_ARCHITECTURE.md
// §1.3). Feed del MVP: solo texto + tipo, con likes, sin comentarios, sin
// multimedia (docs/ESCUADRON_PRODUCT_SPEC.md §13) — nunca lee BodyMetric,
// ProgressPhoto, Meal ni NutritionGoal: la matriz de privacidad aprobada
// (Progreso Corporal/Nutrición solo por publicación explícita) se cumple
// estructuralmente porque el texto del post lo escribe el propio usuario,
// nunca se adjunta ni se lee ningún dato privado de otro módulo.
@Injectable()
export class SquadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly squadAccess: SquadAccessService,
    private readonly evolutionService: EvolutionService,
  ) {}

  // ---- Crear / Unirse / Salir ----

  async createSquad(userId: string, dto: CreateSquadDto) {
    const existing = await this.prisma.squadMembership.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Ya perteneces a un escuadrón. Sal del actual antes de crear uno nuevo.');
    }

    let inviteCode = generateInviteCode();
    // Colisión prácticamente imposible (8 chars de un alfabeto de 32 =
    // ~2^40 combinaciones), pero se verifica en vez de asumir para no dejar
    // un fallo silencioso de unicidad en producción.
    for (let attempts = 0; attempts < 5; attempts++) {
      const clash = await this.prisma.squad.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = generateInviteCode();
    }

    const squad = await this.prisma.squad.create({
      data: {
        name: dto.name,
        isPrivate: dto.isPrivate ?? false,
        inviteCode,
        members: {
          create: { userId, role: 'lider' },
        },
      },
      include: { members: true },
    });

    return squad;
  }

  async joinSquad(userId: string, dto: JoinSquadDto) {
    const existing = await this.prisma.squadMembership.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Ya perteneces a un escuadrón. Sal del actual antes de unirte a otro.');
    }

    const squad = await this.prisma.squad.findUnique({ where: { inviteCode: dto.inviteCode } });
    if (!squad) {
      throw new NotFoundException('Código de invitación inválido');
    }

    await this.prisma.squadMembership.create({
      data: { userId, squadId: squad.id, role: 'miembro' },
    });

    return squad;
  }

  async leaveSquad(userId: string) {
    const membership = await this.prisma.squadMembership.findUnique({ where: { userId } });
    if (!membership) {
      throw new NotFoundException('No perteneces a ningún escuadrón');
    }

    await this.prisma.squadMembership.delete({ where: { userId } });

    // Si el escuadrón queda vacío, se elimina — no tiene sentido conservar
    // un escuadrón sin miembros. NOTA/gap documentado: si el líder se va y
    // quedan miembros, el rol no se reasigna automáticamente en el MVP
    // (eso es parte de "Administrar Escuadrón completo", fuera de alcance,
    // ver docs/ESCUADRON_PRODUCT_SPEC.md §14).
    const remaining = await this.prisma.squadMembership.count({ where: { squadId: membership.squadId } });
    if (remaining === 0) {
      await this.prisma.squad.delete({ where: { id: membership.squadId } });
    }
  }

  // ---- Consulta del propio escuadrón ----

  async getMySquad(userId: string) {
    const membership = await this.prisma.squadMembership.findUnique({
      where: { userId },
      include: { squad: true },
    });
    if (!membership) return null;

    return {
      squad: membership.squad,
      membership: {
        role: membership.role,
        xp: membership.xp,
        streakDays: membership.streakDays,
        joinedAt: membership.joinedAt,
      },
    };
  }

  // ---- Miembros ----

  async listMembers(userId: string) {
    const squadId = await this.squadAccess.getOwnSquadIdOrThrow(userId);

    const memberships = await this.prisma.squadMembership.findMany({
      where: { squadId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { xp: 'desc' },
    });

    return memberships.map((m) => ({
      userId: m.userId,
      displayName: toDisplayName(m.user.email),
      role: m.role,
      xp: m.xp,
      streakDays: m.streakDays,
      joinedAt: m.joinedAt,
    }));
  }

  // Perfil enriquecido de un miembro específico — único punto de Escuadrón
  // que reutiliza un servicio de otro módulo (EvolutionService) con un
  // userId ajeno, y solo después de que SquadAccessService lo autorice.
  // Adherencia/Rachas/PRs visibles por política aprobada
  // (docs/SUENO_ESCUADRON_DECISIONS.md §3) — Progreso Corporal y Nutrición
  // NUNCA se exponen aquí.
  async getMemberProfile(requestingUserId: string, targetUserId: string) {
    await this.squadAccess.assertSharedSquad(requestingUserId, targetUserId);

    const membership = await this.prisma.squadMembership.findUnique({
      where: { userId: targetUserId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!membership) {
      throw new ForbiddenException('No compartes un escuadrón con este usuario');
    }

    const strengthOverview = await this.evolutionService.getStrengthOverview(targetUserId);

    return {
      userId: membership.userId,
      displayName: toDisplayName(membership.user.email),
      role: membership.role,
      xp: membership.xp,
      streakDays: membership.streakDays,
      joinedAt: membership.joinedAt,
      prs: strengthOverview.exercises,
    };
  }

  // ---- Feed (Etapa 3) ----

  async createPost(userId: string, dto: CreateSquadPostDto) {
    const squadId = await this.squadAccess.getOwnSquadIdOrThrow(userId);

    return this.prisma.squadPost.create({
      data: { squadId, authorId: userId, type: dto.type, text: dto.text },
    });
  }

  async listPosts(userId: string) {
    const squadId = await this.squadAccess.getOwnSquadIdOrThrow(userId);

    const posts = await this.prisma.squadPost.findMany({
      where: { squadId },
      include: {
        author: { select: { id: true, email: true } },
        likes: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post) => ({
      id: post.id,
      type: post.type,
      text: post.text,
      createdAt: post.createdAt,
      author: { userId: post.author.id, displayName: toDisplayName(post.author.email) },
      likesCount: post.likes.length,
      likedByMe: post.likes.some((like) => like.userId === userId),
    }));
  }

  // Verifica el post ANTES de tocar SquadPostLike — assertOwnSquad es la
  // única fuente de autorización, nunca se reimplementa la comparación de
  // squadId aquí.
  async likePost(userId: string, postId: string) {
    const post = await this.prisma.squadPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Publicación no encontrada');
    }
    await this.squadAccess.assertOwnSquad(userId, post.squadId);

    const existing = await this.prisma.squadPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      throw new ConflictException('Ya diste like a esta publicación');
    }

    await this.prisma.squadPostLike.create({ data: { postId, userId } });
  }

  async unlikePost(userId: string, postId: string) {
    const post = await this.prisma.squadPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Publicación no encontrada');
    }
    await this.squadAccess.assertOwnSquad(userId, post.squadId);

    const existing = await this.prisma.squadPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (!existing) {
      throw new NotFoundException('No has dado like a esta publicación');
    }

    await this.prisma.squadPostLike.delete({ where: { postId_userId: { postId, userId } } });
  }
}
