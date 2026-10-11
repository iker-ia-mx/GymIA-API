import {
  ForbiddenException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBodyMetricDto } from './dto/create-body-metric.dto.js';
import { CreateProgressPhotoDto } from './dto/create-progress-photo.dto.js';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto.js';

const READ_URL_TTL_SECONDS = 60 * 60; // 1 hour
const UPLOAD_URL_TTL_SECONDS = 60 * 5; // 5 minutes
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class BodyCompositionService {
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ---- BodyMetric ----

  createBodyMetric(userId: string, dto: CreateBodyMetricDto) {
    return this.prisma.bodyMetric.create({
      data: {
        userId,
        weightKg: dto.weightKg,
        bodyFatPct: dto.bodyFatPct,
        leanMassKg: dto.leanMassKg,
        waistCm: dto.waistCm,
        ...(dto.recordedAt ? { recordedAt: new Date(dto.recordedAt) } : {}),
      },
    });
  }

  getBodyMetrics(userId: string) {
    return this.prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  getLatestBodyMetric(userId: string) {
    return this.prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async deleteBodyMetric(userId: string, id: string) {
    const metric = await this.prisma.bodyMetric.findUnique({ where: { id } });
    if (!metric) {
      throw new NotFoundException('Body metric not found');
    }
    if (metric.userId !== userId) {
      throw new ForbiddenException('This body metric does not belong to you');
    }

    await this.prisma.bodyMetric.delete({ where: { id } });
    return { id };
  }

  // ---- ProgressPhoto ----

  async createUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    const contentType = dto.contentType ?? 'image/jpeg';
    const extension = CONTENT_TYPE_EXTENSIONS[contentType];
    const storagePath = `${userId}/${randomUUID()}.${extension}`;

    await this.prisma.progressPhotoUploadIntent.create({
      data: {
        userId,
        storagePath,
        contentType,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
      },
    });

    const { data, error } = await this.getStorageBucket().createSignedUploadUrl(storagePath);
    if (error || !data) {
      await this.prisma.progressPhotoUploadIntent.deleteMany({
        where: { userId, storagePath, consumedAt: null },
      });
      throw new InternalServerErrorException('Could not create an upload URL');
    }

    return {
      storagePath,
      uploadUrl: data.signedUrl,
      token: data.token,
      contentType,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  async createProgressPhoto(userId: string, dto: CreateProgressPhotoDto) {
    const prefix = `${userId}/`;
    if (!dto.storagePath.startsWith(prefix)) {
      throw new ForbiddenException('This storage path does not belong to you');
    }

    const filename = dto.storagePath.slice(prefix.length);
    // Match the UUID filenames issued by createUploadUrl, without subfolders.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/i.test(filename)) {
      throw new ForbiddenException('Invalid progress photo path');
    }

    const intent = await this.prisma.progressPhotoUploadIntent.findUnique({
      where: { storagePath: dto.storagePath },
    });
    if (!intent || intent.userId !== userId || intent.consumedAt ||
        intent.expiresAt <= new Date()) {
      throw new ForbiddenException('Upload authorization is missing or expired');
    }
    if ((intent.contentType === 'image/jpeg' && !filename.endsWith('.jpg')) ||
        (intent.contentType === 'image/png' && !filename.endsWith('.png'))) {
      throw new ForbiddenException('Upload content type mismatch');
    }
    const { data: objects, error } = await this.getStorageBucket().list(userId, {
      search: filename,
      limit: 100,
    });
    if (error) {
      throw new InternalServerErrorException('Could not verify the uploaded photo');
    }
    const object = objects?.find((entry) => entry.name === filename);
    if (!object) {
      throw new NotFoundException('Uploaded photo not found');
    }

    // Storage metadata is necessary but not proof that bytes are a valid image.
    // Reject missing or inconsistent metadata rather than silently accepting it.
    const metadata = object.metadata as Record<string, unknown> | undefined;
    const size = metadata?.size;
    const mimeType = metadata?.mimetype;
    const MAX_PROGRESS_PHOTO_BYTES = 10 * 1024 * 1024;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) ||
        size <= 0 || size > MAX_PROGRESS_PHOTO_BYTES ||
        mimeType !== intent.contentType) {
      throw new ForbiddenException('Uploaded photo metadata is invalid');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.progressPhotoUploadIntent.updateMany({
        where: {
          id: intent.id,
          userId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Upload authorization already consumed');
      }
      return tx.progressPhoto.create({
        data: {
          userId,
          storagePath: dto.storagePath,
          contentType: intent.contentType,
          ...(dto.takenAt ? { takenAt: new Date(dto.takenAt) } : {}),
        },
      });
    });
  }

  async getProgressPhotos(userId: string) {
    const photos = await this.prisma.progressPhoto.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });

    if (photos.length === 0) {
      return [];
    }

    const bucket = this.getStorageBucket();
    return Promise.all(
      photos.map(async (photo) => {
        const { data, error } = await bucket.createSignedUrl(
          photo.storagePath,
          READ_URL_TTL_SECONDS,
        );
        if (error || !data) {
          throw new InternalServerErrorException('Could not create a read URL for a photo');
        }

        return {
          id: photo.id,
          takenAt: photo.takenAt,
          contentType: photo.contentType,
          url: data.signedUrl,
          expiresInSeconds: READ_URL_TTL_SECONDS,
        };
      }),
    );
  }

  async deleteProgressPhoto(userId: string, id: string) {
    const photo = await this.prisma.progressPhoto.findUnique({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Progress photo not found');
    }
    if (photo.userId !== userId) {
      throw new ForbiddenException('This progress photo does not belong to you');
    }

    const { error } = await this.getStorageBucket().remove([photo.storagePath]);
    if (error) {
      throw new InternalServerErrorException('Could not delete the photo file from storage');
    }

    await this.prisma.progressPhoto.delete({ where: { id } });
    return { id };
  }

  // ---- Storage client (lazy: only required when a photo endpoint is actually used) ----

  private getStorageBucket() {
    if (!this.supabase) {
      const url = this.configService.getOrThrow<string>('SUPABASE_URL');
      const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
      this.supabase = createClient(url, serviceRoleKey);
    }

    const bucketName = this.configService.get<string>(
      'SUPABASE_STORAGE_BUCKET',
      'progress-photos',
    );
    return this.supabase.storage.from(bucketName);
  }
}
