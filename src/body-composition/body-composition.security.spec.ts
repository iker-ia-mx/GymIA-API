import { ForbiddenException } from '@nestjs/common';
import { BodyCompositionService } from './body-composition.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

// Regression tests for the current photo registration contract.
// The last test is intentionally RED against the current implementation:
// registration must not succeed merely because the path starts with userId/.
describe('BodyCompositionService - photo registration authorization', () => {
  const ownerId = 'user-a';
  const photoPath = 'user-a/12345678-1234-1234-1234-123456789abc.jpg';
  let create: ReturnType<typeof vi.fn>;
  let service: BodyCompositionService;

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({ id: 'photo-1', userId: ownerId });
    const prisma = { progressPhoto: { create } } as unknown as PrismaService;
    const config = { get: vi.fn(), getOrThrow: vi.fn() } as unknown as ConfigService;
    service = new BodyCompositionService(prisma, config);
  });

  it('rejects another user folder before creating a database record', async () => {
    await expect(
      service.createProgressPhoto(ownerId, {
        storagePath: 'user-b/12345678-1234-1234-1234-123456789abc.jpg',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('currently allows a matching user prefix', async () => {
    await service.createProgressPhoto(ownerId, { storagePath: photoPath });
    expect(create).toHaveBeenCalledWith({
      data: { userId: ownerId, storagePath: photoPath },
    });
  });

  it('SEC-07 RED: must reject a nonexistent upload even when the user prefix matches', async () => {
    // No upload intent or Storage object exists in this test.
    // This assertion intentionally fails until the upload-intent validation
    // and Storage existence checks are implemented.
    await expect(
      service.createProgressPhoto(ownerId, {
        storagePath: 'user-a/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
