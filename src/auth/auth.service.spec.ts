import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { Mock } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { JwtService } from '@nestjs/jwt';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: { findUnique: Mock; create: Mock };
    refreshToken: { create: Mock; findUnique: Mock; update: Mock };
  };
  let jwtService: { signAsync: Mock };

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    password: 'hashed-password',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'refresh-id-1' }),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    jwtService = {
      signAsync: vi.fn(),
    };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('crea un usuario correctamente', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'plain-password',
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza un email duplicado con ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.register({ email: mockUser.email, password: 'plain-password' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('almacena la contraseña hasheada, nunca en texto plano', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('super-hashed-value');
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'plain-password',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: 'super-hashed-value',
        },
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('con credenciales correctas devuelve un accessToken (JWT)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await authService.login({
        email: mockUser.email,
        password: 'plain-password',
      });

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        refreshToken: expect.any(String),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('plain-password', mockUser.password);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('con un email inexistente lanza UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'no-existe@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('con una contraseña incorrecta lanza UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as Mock).mockResolvedValue(false);

      await expect(
        authService.login({ email: mockUser.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    const validStoredToken = {
      id: 'refresh-id-1',
      userId: mockUser.id,
      tokenHash: 'irrelevant-in-this-mock',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null as Date | null,
    };

    it('con un refresh token válido emite un nuevo access token y rota el refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStoredToken);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('new.signed.jwt.token');

      const result = await authService.refreshTokens('some-raw-refresh-token');

      expect(result).toEqual({
        accessToken: 'new.signed.jwt.token',
        refreshToken: expect.any(String),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
        },
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: validStoredToken.id },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('con un refresh token inexistente lanza UnauthorizedException', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.refreshTokens('unknown-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('con un refresh token revocado lanza UnauthorizedException', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStoredToken,
        revokedAt: new Date(),
      });

      await expect(authService.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('con un refresh token expirado lanza UnauthorizedException', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
