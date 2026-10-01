import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Única costura de todo el backend autorizada a cruzar la frontera de
// userId (docs/ESCUADRON_TECHNICAL_ARCHITECTURE.md §1). El resto del
// proyecto sigue aislado por convención de controller como siempre — este
// es el único punto donde un servicio recibe intencionalmente el userId de
// otra persona, y solo después de que este método lo autorice.
//
// Se verifica en cada llamada, nunca se cachea ni se guarda en el token:
// salir de un escuadrón (borrar la SquadMembership) revoca la visibilidad
// de inmediato en la siguiente petición.
@Injectable()
export class SquadAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Autoriza que `requestingUserId` lea datos de `targetUserId` en el
  // contexto de Escuadrón. Dos casos válidos:
  //   1. Es la misma persona y tiene una membresía propia.
  //   2. Ambos pertenecen activamente al mismo escuadrón.
  // Devuelve el squadId compartido cuando autoriza; lanza
  // ForbiddenException en cualquier otro caso (incluyendo cuando cualquiera
  // de los dos no pertenece a ningún escuadrón).
  async assertSharedSquad(requestingUserId: string, targetUserId: string): Promise<string> {
    const requester = await this.prisma.squadMembership.findUnique({
      where: { userId: requestingUserId },
    });
    if (!requester) {
      throw new ForbiddenException('No perteneces a ningún escuadrón');
    }

    if (requestingUserId === targetUserId) {
      return requester.squadId;
    }

    const target = await this.prisma.squadMembership.findUnique({
      where: { userId: targetUserId },
    });
    if (!target || target.squadId !== requester.squadId) {
      throw new ForbiddenException('No compartes un escuadrón con este usuario');
    }

    return requester.squadId;
  }

  // Variante usada por endpoints que solo necesitan saber "¿pertenezco a un
  // escuadrón?" sin comparar contra otro usuario (p. ej. el propio Hub).
  async getOwnSquadIdOrThrow(userId: string): Promise<string> {
    const membership = await this.prisma.squadMembership.findUnique({ where: { userId } });
    if (!membership) {
      throw new ForbiddenException('No perteneces a ningún escuadrón');
    }
    return membership.squadId;
  }

  // Autoriza que `userId` opere sobre un recurso que ya sabemos que
  // pertenece a `squadId` (un post, por ejemplo) — evita que un miembro del
  // Escuadrón A lea o le dé like a contenido del Escuadrón B. Misma
  // filosofía que assertSharedSquad: una sola costura, reutilizada, nunca
  // reimplementada dentro de SquadService.
  async assertOwnSquad(userId: string, squadId: string): Promise<void> {
    const ownSquadId = await this.getOwnSquadIdOrThrow(userId);
    if (ownSquadId !== squadId) {
      throw new ForbiddenException('Este contenido no pertenece a tu escuadrón');
    }
  }
}
