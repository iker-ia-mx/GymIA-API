import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { SquadService } from './squad.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SquadAccessService } from './squad-access.service.js';
import type { EvolutionService } from '../evolution/evolution.service.js';

describe('SquadService', () => {
  let service: SquadService;
  let prisma: {
    squadMembership: { findUnique: Mock; findMany: Mock; create: Mock; delete: Mock; count: Mock };
    squad: { findUnique: Mock; create: Mock; delete: Mock };
    squadPost: { create: Mock; findMany: Mock; findUnique: Mock };
    squadPostLike: { findUnique: Mock; create: Mock; delete: Mock };
  };
  let squadAccess: { assertSharedSquad: Mock; getOwnSquadIdOrThrow: Mock; assertOwnSquad: Mock };
  let evolutionService: { getStrengthOverview: Mock };

  const userId = 'user-1';
  const otherUserId = 'user-2';
  const squadId = 'squad-1';
  const otherSquadId = 'squad-2';
  const postId = 'post-1';

  beforeEach(() => {
    prisma = {
      squadMembership: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
      squad: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
      squadPost: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
      squadPostLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    };
    squadAccess = { assertSharedSquad: vi.fn(), getOwnSquadIdOrThrow: vi.fn(), assertOwnSquad: vi.fn() };
    evolutionService = { getStrengthOverview: vi.fn() };
    service = new SquadService(
      prisma as unknown as PrismaService,
      squadAccess as unknown as SquadAccessService,
      evolutionService as unknown as EvolutionService,
    );
  });

  describe('createSquad', () => {
    it('crea el escuadrón y la membresía del creador como líder cuando no pertenece a ninguno', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);
      prisma.squad.findUnique.mockResolvedValue(null); // sin colisión de inviteCode
      prisma.squad.create.mockResolvedValue({ id: squadId, name: 'Los Fuertes' });

      const result = await service.createSquad(userId, { name: 'Los Fuertes' });

      expect(result).toEqual({ id: squadId, name: 'Los Fuertes' });
      expect(prisma.squad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Los Fuertes',
            isPrivate: false,
            members: { create: { userId, role: 'lider' } },
          }),
        }),
      );
    });

    it('genera un inviteCode de 8 caracteres del alfabeto esperado', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);
      prisma.squad.findUnique.mockResolvedValue(null);
      prisma.squad.create.mockResolvedValue({});

      await service.createSquad(userId, { name: 'Los Fuertes' });

      const callArg = prisma.squad.create.mock.calls[0][0];
      expect(callArg.data.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    });

    it('reintenta generar el código si colisiona con uno existente', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);
      prisma.squad.findUnique
        .mockResolvedValueOnce({ id: 'squad-existing' }) // colisión en el primer intento
        .mockResolvedValueOnce(null); // libre en el segundo
      prisma.squad.create.mockResolvedValue({});

      await service.createSquad(userId, { name: 'Los Fuertes' });

      expect(prisma.squad.findUnique).toHaveBeenCalledTimes(2);
    });

    it('rechaza crear un escuadrón si el usuario ya pertenece a uno', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue({ userId, squadId });

      await expect(service.createSquad(userId, { name: 'Otro' })).rejects.toThrow(ConflictException);
      expect(prisma.squad.create).not.toHaveBeenCalled();
    });
  });

  describe('joinSquad', () => {
    it('crea la membresía como miembro cuando el código es válido', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);
      prisma.squad.findUnique.mockResolvedValue({ id: squadId, inviteCode: 'ABCD1234' });

      const result = await service.joinSquad(userId, { inviteCode: 'ABCD1234' });

      expect(result).toEqual({ id: squadId, inviteCode: 'ABCD1234' });
      expect(prisma.squadMembership.create).toHaveBeenCalledWith({
        data: { userId, squadId, role: 'miembro' },
      });
    });

    it('rechaza unirse si el usuario ya pertenece a un escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue({ userId, squadId });

      await expect(service.joinSquad(userId, { inviteCode: 'ABCD1234' })).rejects.toThrow(ConflictException);
      expect(prisma.squadMembership.create).not.toHaveBeenCalled();
    });

    it('rechaza un código de invitación inválido', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);
      prisma.squad.findUnique.mockResolvedValue(null);

      await expect(service.joinSquad(userId, { inviteCode: 'BADCODE1' })).rejects.toThrow(NotFoundException);
      expect(prisma.squadMembership.create).not.toHaveBeenCalled();
    });
  });

  describe('leaveSquad', () => {
    it('elimina la membresía y borra el escuadrón si queda vacío', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue({ userId, squadId });
      prisma.squadMembership.count.mockResolvedValue(0);

      await service.leaveSquad(userId);

      expect(prisma.squadMembership.delete).toHaveBeenCalledWith({ where: { userId } });
      expect(prisma.squad.delete).toHaveBeenCalledWith({ where: { id: squadId } });
    });

    it('elimina la membresía pero conserva el escuadrón si quedan más miembros', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue({ userId, squadId });
      prisma.squadMembership.count.mockResolvedValue(2);

      await service.leaveSquad(userId);

      expect(prisma.squadMembership.delete).toHaveBeenCalledWith({ where: { userId } });
      expect(prisma.squad.delete).not.toHaveBeenCalled();
    });

    it('rechaza salir si el usuario no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);

      await expect(service.leaveSquad(userId)).rejects.toThrow(NotFoundException);
      expect(prisma.squadMembership.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMySquad', () => {
    it('devuelve null cuando el usuario no pertenece a ningún escuadrón', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue(null);

      await expect(service.getMySquad(userId)).resolves.toBeNull();
    });

    it('devuelve el escuadrón y el resumen de membresía cuando existe', async () => {
      prisma.squadMembership.findUnique.mockResolvedValue({
        role: 'lider',
        xp: 120,
        streakDays: 4,
        joinedAt: new Date('2026-09-01'),
        squad: { id: squadId, name: 'Los Fuertes' },
      });

      const result = await service.getMySquad(userId);

      expect(result).toEqual({
        squad: { id: squadId, name: 'Los Fuertes' },
        membership: { role: 'lider', xp: 120, streakDays: 4, joinedAt: new Date('2026-09-01') },
      });
    });
  });

  describe('listMembers', () => {
    it('delega la verificación de pertenencia en SquadAccessService (sin duplicar lógica de permisos)', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockResolvedValue(squadId);
      prisma.squadMembership.findMany.mockResolvedValue([]);

      await service.listMembers(userId);

      expect(squadAccess.getOwnSquadIdOrThrow).toHaveBeenCalledWith(userId);
      expect(prisma.squadMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { squadId } }),
      );
    });

    it('propaga el rechazo de SquadAccessService sin consultar miembros', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockRejectedValue(new ForbiddenException());

      await expect(service.listMembers(userId)).rejects.toThrow(ForbiddenException);
      expect(prisma.squadMembership.findMany).not.toHaveBeenCalled();
    });

    it('mapea cada miembro con displayName derivado del email, nunca el email completo', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockResolvedValue(squadId);
      prisma.squadMembership.findMany.mockResolvedValue([
        {
          userId: otherUserId,
          role: 'miembro',
          xp: 50,
          streakDays: 2,
          joinedAt: new Date('2026-09-10'),
          user: { id: otherUserId, email: 'otro@example.com' },
        },
      ]);

      const result = await service.listMembers(userId);

      expect(result).toEqual([
        {
          userId: otherUserId,
          displayName: 'otro',
          role: 'miembro',
          xp: 50,
          streakDays: 2,
          joinedAt: new Date('2026-09-10'),
        },
      ]);
    });
  });

  describe('getMemberProfile', () => {
    it('llama a SquadAccessService.assertSharedSquad ANTES de tocar cualquier otro dato', async () => {
      squadAccess.assertSharedSquad.mockResolvedValue(squadId);
      prisma.squadMembership.findUnique.mockResolvedValue({
        userId: otherUserId,
        role: 'miembro',
        xp: 80,
        streakDays: 3,
        joinedAt: new Date('2026-09-05'),
        user: { id: otherUserId, email: 'otro@example.com' },
      });
      evolutionService.getStrengthOverview.mockResolvedValue({
        weeklyVolumeKg: 100,
        weeklyVolumeDeltaKg: 10,
        exercises: [{ exerciseId: 'e1', exerciseName: 'Sentadilla', currentEstimatedOneRepMax: 100 }],
      });

      const result = await service.getMemberProfile(userId, otherUserId);

      expect(squadAccess.assertSharedSquad).toHaveBeenCalledWith(userId, otherUserId);
      expect(evolutionService.getStrengthOverview).toHaveBeenCalledWith(otherUserId);
      expect(result).toEqual({
        userId: otherUserId,
        displayName: 'otro',
        role: 'miembro',
        xp: 80,
        streakDays: 3,
        joinedAt: new Date('2026-09-05'),
        prs: [{ exerciseId: 'e1', exerciseName: 'Sentadilla', currentEstimatedOneRepMax: 100 }],
      });
    });

    it('nunca consulta EvolutionService si la gate function rechaza (sin bypass posible)', async () => {
      squadAccess.assertSharedSquad.mockRejectedValue(new ForbiddenException('No compartes un escuadrón'));

      await expect(service.getMemberProfile(userId, otherUserId)).rejects.toThrow(ForbiddenException);
      expect(prisma.squadMembership.findUnique).not.toHaveBeenCalled();
      expect(evolutionService.getStrengthOverview).not.toHaveBeenCalled();
    });
  });

  describe('createPost', () => {
    it('crea el post en el escuadrón propio del autor', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockResolvedValue(squadId);
      prisma.squadPost.create.mockResolvedValue({ id: postId });

      await service.createPost(userId, { type: 'entrenamiento', text: 'Rompí mi PR de sentadilla!' });

      expect(squadAccess.getOwnSquadIdOrThrow).toHaveBeenCalledWith(userId);
      expect(prisma.squadPost.create).toHaveBeenCalledWith({
        data: { squadId, authorId: userId, type: 'entrenamiento', text: 'Rompí mi PR de sentadilla!' },
      });
    });

    it('propaga el rechazo si el usuario no pertenece a ningún escuadrón', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockRejectedValue(new ForbiddenException());

      await expect(service.createPost(userId, { type: 'comida', text: 'Almuerzo' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.squadPost.create).not.toHaveBeenCalled();
    });
  });

  describe('listPosts', () => {
    it('lista solo los posts del propio escuadrón, con contador de likes y likedByMe', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockResolvedValue(squadId);
      prisma.squadPost.findMany.mockResolvedValue([
        {
          id: postId,
          type: 'progreso',
          text: 'Bajé 2kg esta semana',
          createdAt: new Date('2026-09-25'),
          author: { id: otherUserId, email: 'otro@example.com' },
          likes: [{ userId }, { userId: 'user-3' }],
        },
      ]);

      const result = await service.listPosts(userId);

      expect(prisma.squadPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { squadId }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toEqual([
        {
          id: postId,
          type: 'progreso',
          text: 'Bajé 2kg esta semana',
          createdAt: new Date('2026-09-25'),
          author: { userId: otherUserId, displayName: 'otro' },
          likesCount: 2,
          likedByMe: true,
        },
      ]);
    });

    it('nunca lee BodyMetric, ProgressPhoto, Meal ni NutritionGoal (privacidad estructural del feed)', async () => {
      squadAccess.getOwnSquadIdOrThrow.mockResolvedValue(squadId);
      prisma.squadPost.findMany.mockResolvedValue([]);

      await service.listPosts(userId);

      const callArg = prisma.squadPost.findMany.mock.calls[0][0];
      const includeKeys = Object.keys(callArg.include);
      expect(includeKeys).toEqual(['author', 'likes']);
    });
  });

  describe('likePost', () => {
    it('crea el like cuando el post pertenece al escuadrón del usuario y no existe like previo', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId });
      squadAccess.assertOwnSquad.mockResolvedValue(undefined);
      prisma.squadPostLike.findUnique.mockResolvedValue(null);

      await service.likePost(userId, postId);

      expect(squadAccess.assertOwnSquad).toHaveBeenCalledWith(userId, squadId);
      expect(prisma.squadPostLike.create).toHaveBeenCalledWith({ data: { postId, userId } });
    });

    it('rechaza con NotFoundException si el post no existe', async () => {
      prisma.squadPost.findUnique.mockResolvedValue(null);

      await expect(service.likePost(userId, postId)).rejects.toThrow(NotFoundException);
      expect(squadAccess.assertOwnSquad).not.toHaveBeenCalled();
    });

    it('rechaza con ForbiddenException (vía la gate function) si el post es de otro escuadrón', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId: otherSquadId });
      squadAccess.assertOwnSquad.mockRejectedValue(new ForbiddenException());

      await expect(service.likePost(userId, postId)).rejects.toThrow(ForbiddenException);
      expect(prisma.squadPostLike.create).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictException si ya existe un like del mismo usuario', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId });
      squadAccess.assertOwnSquad.mockResolvedValue(undefined);
      prisma.squadPostLike.findUnique.mockResolvedValue({ postId, userId });

      await expect(service.likePost(userId, postId)).rejects.toThrow(ConflictException);
      expect(prisma.squadPostLike.create).not.toHaveBeenCalled();
    });
  });

  describe('unlikePost', () => {
    it('elimina el like existente tras verificar pertenencia al escuadrón', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId });
      squadAccess.assertOwnSquad.mockResolvedValue(undefined);
      prisma.squadPostLike.findUnique.mockResolvedValue({ postId, userId });

      await service.unlikePost(userId, postId);

      expect(prisma.squadPostLike.delete).toHaveBeenCalledWith({ where: { postId_userId: { postId, userId } } });
    });

    it('rechaza con NotFoundException si no existe un like previo', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId });
      squadAccess.assertOwnSquad.mockResolvedValue(undefined);
      prisma.squadPostLike.findUnique.mockResolvedValue(null);

      await expect(service.unlikePost(userId, postId)).rejects.toThrow(NotFoundException);
      expect(prisma.squadPostLike.delete).not.toHaveBeenCalled();
    });

    it('rechaza con ForbiddenException si el post es de otro escuadrón (sin tocar el like)', async () => {
      prisma.squadPost.findUnique.mockResolvedValue({ id: postId, squadId: otherSquadId });
      squadAccess.assertOwnSquad.mockRejectedValue(new ForbiddenException());

      await expect(service.unlikePost(userId, postId)).rejects.toThrow(ForbiddenException);
      expect(prisma.squadPostLike.findUnique).not.toHaveBeenCalled();
      expect(prisma.squadPostLike.delete).not.toHaveBeenCalled();
    });
  });
});
