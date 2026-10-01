import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    return this.buildUserResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: this.buildUserResponse(user),
    };
  }

  async refreshTokens(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotación: el refresh token usado queda inválido, se emite uno nuevo.
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: this.buildUserResponse(user),
    };
  }

  // "Cambiar Contraseña" (Perfil → Seguridad y Avisos). Requiere la
  // contraseña actual — mismo patrón de verificación que login, nunca se
  // confía en el userId del JWT solo para una operación sensible. Revoca
  // todos los refresh tokens vivos (deuda técnica ya señalada en
  // 01.02 Auditoría backend: "cambiar contraseña no revoca refresh
  // tokens") — una sesión robada con el refresh token anterior no debe
  // sobrevivir a un cambio de contraseña.
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // "Eliminar Cuenta Permanente" (Perfil → Ayuda y Soporte, Zona de
  // Peligro). Requiere reingresar la contraseña — acción irreversible.
  // El borrado en cascada de todo el resto de los datos del usuario
  // (rutinas, sesiones, métricas, comidas, sueño, escuadrón, etc.) ya está
  // garantizado por `onDelete: Cascade` en cada relación del esquema
  // Prisma — un solo `user.delete` es seguro y completo.
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Password is incorrect');
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });

    return rawToken;
  }

  private buildUserResponse(user: {
    id: string;
    email: string;
    createdAt: Date;
    onboardingCompletedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
    };
  }
}
