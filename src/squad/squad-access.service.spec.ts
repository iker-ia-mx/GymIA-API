import { ForbiddenException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { SquadAccessService } from './squad-access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// Tests de seguridad de la única costura autorizada a cruzar la frontera de
// userId en todo el backend (docs/ESCUADRON_TECHNICAL_ARCHITECTURE.md §1).
// Cada caso aquí es, literalmente, una regla de quién puede ver los datos
// de quién — no son tests de conveniencia, son el contrato de seguridad.
describe('SquadAccessService', () => {
  let service: SquadAccessService;
  let prisma: { squadMembership: { findUnique: Mock } };

  const userA = 'user-a';
  const userB = 'user-b';
  const squadX = 'squad-x';
  const squadY = 'squad-y';

  beforeEach(() => {
    prisma = { squadMembership: { findUnique: vi.fn() } };
    service = new SquadAccessService(prisma as unknown as PrismaService);
  });

  describe('assertSharedSquad', () => {
    it('autoriza a un usuario a leer sus propios datos cuando tiene membresía', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce({ userId: userA, squadId: squadX });

      const result = await service.assertSharedSquad(userA, userA);

      expect(result).toBe(squadX);
      // Caso "misma persona" resuelve con una sola consulta, no dos.
      expect(prisma.squadMembership.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.squadMembership.findUnique).toHaveBeenCalledWith({ where: { userId: userA } });
    });

    it('rechaza a un usuario sin escuadrón que intenta leer sus propios datos', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce(null);

      await expect(service.assertSharedSquad(userA, userA)).rejects.toThrow(ForbiddenException);
    });

    it('autoriza cuando ambos usuarios pertenecen al mismo escuadrón activo', async () => {
      prisma.squadMembership.findUnique
        .mockResolvedValueOnce({ userId: userA, squadId: squadX }) // requester
        .mockResolvedValueOnce({ userId: userB, squadId: squadX }); // target

      const result = await service.assertSharedSquad(userA, userB);

      expect(result).toBe(squadX);
    });

    it('rechaza cuando el usuario que pregunta no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce(null); // requester sin membresía

      await expect(service.assertSharedSquad(userA, userB)).rejects.toThrow(ForbiddenException);
      // No debe ni siquiera consultar al usuario objetivo — corta en el primer chequeo.
      expect(prisma.squadMembership.findUnique).toHaveBeenCalledTimes(1);
    });

    it('rechaza cuando el usuario objetivo no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique
        .mockResolvedValueOnce({ userId: userA, squadId: squadX }) // requester
        .mockResolvedValueOnce(null); // target sin membresía

      await expect(service.assertSharedSquad(userA, userB)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza cuando ambos usuarios pertenecen a escuadrones distintos', async () => {
      prisma.squadMembership.findUnique
        .mockResolvedValueOnce({ userId: userA, squadId: squadX })
        .mockResolvedValueOnce({ userId: userB, squadId: squadY });

      await expect(service.assertSharedSquad(userA, userB)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza a un ex-miembro inmediatamente tras salir del escuadrón (revocación en vivo, sin caché)', async () => {
      // Simula: userB ya no tiene fila de membresía (salió del escuadrón).
      prisma.squadMembership.findUnique
        .mockResolvedValueOnce({ userId: userA, squadId: squadX })
        .mockResolvedValueOnce(null);

      await expect(service.assertSharedSquad(userA, userB)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOwnSquadIdOrThrow', () => {
    it('devuelve el squadId cuando el usuario tiene membresía', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce({ userId: userA, squadId: squadX });

      await expect(service.getOwnSquadIdOrThrow(userA)).resolves.toBe(squadX);
    });

    it('lanza ForbiddenException cuando el usuario no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce(null);

      await expect(service.getOwnSquadIdOrThrow(userA)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertOwnSquad', () => {
    it('autoriza cuando el recurso pertenece al propio escuadrón del usuario', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce({ userId: userA, squadId: squadX });

      await expect(service.assertOwnSquad(userA, squadX)).resolves.toBeUndefined();
    });

    it('rechaza cuando el recurso pertenece a un escuadrón distinto (aislamiento entre escuadrones)', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce({ userId: userA, squadId: squadX });

      await expect(service.assertOwnSquad(userA, squadY)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza cuando el usuario no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValueOnce(null);

      await expect(service.assertOwnSquad(userA, squadX)).rejects.toThrow(ForbiddenException);
    });
  });
});
