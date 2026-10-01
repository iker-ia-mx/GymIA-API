import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('responde ok cuando la base contesta', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const result = await new HealthController(prisma).check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('responde 503 cuando la base no contesta', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as PrismaService;
    await expect(new HealthController(prisma).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
