import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';

// Health check para el hosting (Render/Railway/Fly). Sin JWT y sin rate
// limit: el balanceador lo llama cada pocos segundos. Responde 200 solo si
// la base de datos contesta; 503 si no, para que el hosting no enrute
// tráfico a una instancia que no puede servir.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      database: 'up',
      dbLatencyMs: Date.now() - startedAt,
      uptimeS: Math.round(process.uptime()),
      version: process.env.RENDER_GIT_COMMIT ?? process.env.APP_VERSION ?? null,
    };
  }
}
