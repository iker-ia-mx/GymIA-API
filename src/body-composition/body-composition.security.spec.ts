import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BodyCompositionService } from './body-composition.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

describe('BodyCompositionService - photo upload authorization', () => {
  const ownerId = 'user-a';
  const filename = '12345678-1234-1234-1234-123456789abc.jpg';
  const photoPath = `${ownerId}/${filename}`;
  const intent = {
    id: 'intent-1', userId: ownerId, storagePath: photoPath,
    contentType: 'image/jpeg', expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };
  let create: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  let service: BodyCompositionService;

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({ id: 'photo-1', userId: ownerId });
    list = vi.fn().mockResolvedValue({ data: [{ name: filename }], error: null });
    findUnique = vi.fn().mockResolvedValue({ ...intent, expiresAt: new Date(Date.now() + 60_000) });
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { progressPhotoUploadIntent: { updateMany }, progressPhoto: { create } };
    const prisma = {
      progressPhotoUploadIntent: { findUnique },
      $transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const config = { get: vi.fn(), getOrThrow: vi.fn() } as unknown as ConfigService;
    service = new BodyCompositionService(prisma, config);
    (service as unknown as { getStorageBucket: () => unknown }).getStorageBucket =
      () => ({ list });
  });

  it('issues a signed upload URL only after persisting its authorization', async () => {
    const order: string[] = [];
    const createIntent = vi.fn().mockImplementation(async () => {
      order.push('intent');
      return { id: 'new-intent' };
    });
    const signedUpload = vi.fn().mockImplementation(async () => {
      order.push('signed-url');
      return { data: { signedUrl: 'https://example.invalid/upload', token: 'mock-token' }, error: null };
    });
    const prisma = (service as unknown as { prisma: { progressPhotoUploadIntent: {
      create: typeof createIntent; deleteMany: ReturnType<typeof vi.fn>;
    } } }).prisma;
    prisma.progressPhotoUploadIntent.create = createIntent;
    prisma.progressPhotoUploadIntent.deleteMany = vi.fn();
    (service as unknown as { getStorageBucket: () => unknown }).getStorageBucket =
      () => ({ createSignedUploadUrl: signedUpload });

    const result = await service.createUploadUrl(ownerId, { contentType: 'image/jpeg' });
    expect(order).toEqual(['intent', 'signed-url']);
    expect(result.storagePath).toMatch(/^user-a\/[0-9a-f-]+\.jpg$/);
    expect(createIntent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ownerId,
        storagePath: result.storagePath,
        contentType: 'image/jpeg',
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('cleans up upload intent when signed URL generation returns an error', async () => {
    const createIntent = vi.fn().mockResolvedValue({ id: 'new-intent' });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = (service as unknown as { prisma: { progressPhotoUploadIntent: {
      create: typeof createIntent; deleteMany: typeof deleteMany;
    } } }).prisma;
    prisma.progressPhotoUploadIntent.create = createIntent;
    prisma.progressPhotoUploadIntent.deleteMany = deleteMany;
    (service as unknown as { getStorageBucket: () => unknown }).getStorageBucket =
      () => ({ createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: null, error: { message: 'storage unavailable' },
      }) });
    await expect(service.createUploadUrl(ownerId, { contentType: 'image/jpeg' }))
      .rejects.toThrow(InternalServerErrorException);
    expect(deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: ownerId, consumedAt: null }),
    });
  });

  it('rejects a path in another user folder', async () => {
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: `user-b/${filename}`,
    })).rejects.toThrow(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('finalizes a valid, unexpired intent once', async () => {
    await service.createProgressPhoto(ownerId, { storagePath: photoPath });
    expect(list).toHaveBeenCalledWith(ownerId, { search: filename, limit: 100 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'intent-1', userId: ownerId, consumedAt: null }),
    }));
    expect(create).toHaveBeenCalledWith({
      data: { userId: ownerId, storagePath: photoPath, contentType: 'image/jpeg' },
    });
  });

  it('rejects a missing upload intent', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an expired intent', async () => {
    findUnique.mockResolvedValue({ ...intent, expiresAt: new Date(Date.now() - 60_000) });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an intent belonging to another user', async () => {
    findUnique.mockResolvedValue({ ...intent, userId: 'user-b' });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an already consumed intent', async () => {
    findUnique.mockResolvedValue({ ...intent, consumedAt: new Date() });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a race when another request consumed the intent first', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a missing Storage object', async () => {
    list.mockResolvedValue({ data: [], error: null });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed when Storage errors', async () => {
    list.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(service.createProgressPhoto(ownerId, {
      storagePath: photoPath,
    })).rejects.toThrow(InternalServerErrorException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects path traversal and non-UUID filenames', async () => {
    for (const path of [`${ownerId}/../user-b/${filename}`, `${ownerId}/custom.jpg`]) {
      await expect(service.createProgressPhoto(ownerId, { storagePath: path }))
        .rejects.toThrow(ForbiddenException);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });
});
