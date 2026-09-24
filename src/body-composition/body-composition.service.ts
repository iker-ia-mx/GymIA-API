import {
  ForbiddenException,
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

    const { data, error } = await this.getStorageBucket().createSignedUploadUrl(storagePath);
    if (error || !data) {
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

  createProgressPhoto(userId: string, dto: CreateProgressPhotoDto) {
    if (!dto.storagePath.startsWith(`${userId}/`)) {
      throw new ForbiddenException('This storage path does not belong to you');
    }

    return this.prisma.progressPhoto.create({
      data: {
        userId,
        storagePath: dto.storagePath,
        ...(dto.takenAt ? { takenAt: new Date(dto.takenAt) } : {}),
      },
    });
  }

  async getProgressPhotos(userId: string) {
    const photos = await this.prisma.progressPhoto.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });

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
