import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BodyCompositionService } from './body-composition.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

describe('BodyCompositionService - photo registration security', () => {
  const ownerId = 'user-a';
  const filename = '12345678-1234-1234-1234-123456789abc.jpg';
  const photoPath = `${ownerId}/${filename}`;
  let create: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;
  let service: BodyCompositionService;

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({ id: 'photo-1', userId: ownerId });
    list = vi.fn().mockResolvedValue({
      data: [{ name: filename }],
      error: null,
    });
    const prisma = { progressPhoto: { create } } as unknown as PrismaService;
    const config = { get: vi.fn(), getOrThrow: vi.fn() } as unknown as ConfigService;
    service = new BodyCompositionService(prisma, config);
    (service as unknown as { getStorageBucket: () => unknown }).getStorageBucket =
      () => ({ list });
  });

  it('rejects another user folder before any Storage request', async () => {
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: `user-b/${filename}`,
    })).rejects.toThrow(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('registers an existing file in the authenticated user folder', async () => {
    await service.createProgressPhoto(ownerId, { storagePath: photoPath });
    expect(list).toHaveBeenCalledWith(ownerId, {
      search: filename,
      limit: 100,
    });
    expect(create).toHaveBeenCalledWith({
      data: { userId: ownerId, storagePath: photoPath },
    });
  });

  it('SEC-07: rejects a nonexistent file despite a matching user prefix', async () => {
    list.mockResolvedValue({ data: [], error: null });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: `${ownerId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`,
    })).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects nested paths and traversal', async () => {
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: `${ownerId}/../user-b/${filename}`,
    })).rejects.toThrow(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects filenames not issued in the UUID format', async () => {
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: `${ownerId}/my-photo.jpg`,
    })).rejects.toThrow(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed when Storage cannot confirm existence', async () => {
    list.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(InternalServerErrorException);
    expect(create).not.toHaveBeenCalled();
  });
});
