import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConnectSleepSourceDto } from './dto/connect-sleep-source.dto.js';
import { ImportSleepSessionDto } from './dto/import-sleep-session.dto.js';

const sessionInclude = { stages: { orderBy: { startedAt: 'asc' as const } } };

@Injectable()
export class SleepService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Sessions ----

  importSession(userId: string, dto: ImportSleepSessionDto) {
    return this.prisma.sleepSession.create({
      data: {
        userId,
        startedAt: new Date(dto.startedAt),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        timeInBedMinutes: dto.timeInBedMinutes,
        sleepEfficiencyPct: dto.sleepEfficiencyPct,
        recoveryScorePct: dto.recoveryScorePct,
        avgHeartRateBpm: dto.avgHeartRateBpm,
        minHeartRateBpm: dto.minHeartRateBpm,
        hrvMs: dto.hrvMs,
        respiratoryRateBpm: dto.respiratoryRateBpm,
        dataQuality: dto.dataQuality,
        source: dto.source,
        ...(dto.stages && dto.stages.length > 0
          ? {
              stages: {
                create: dto.stages.map((stage) => ({
                  stage: stage.stage,
                  startedAt: new Date(stage.startedAt),
                  endedAt: stage.endedAt ? new Date(stage.endedAt) : undefined,
                })),
              },
            }
          : {}),
      },
      include: sessionInclude,
    });
  }

  getSessions(userId: string) {
    return this.prisma.sleepSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: sessionInclude,
    });
  }

  getLatestSession(userId: string) {
    return this.prisma.sleepSession.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: sessionInclude,
    });
  }

  async getSessionById(userId: string, id: string) {
    const session = await this.prisma.sleepSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session) {
      throw new NotFoundException('Sleep session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('This sleep session does not belong to you');
    }
    return session;
  }

  async deleteSession(userId: string, id: string) {
    await this.getSessionById(userId, id);
    await this.prisma.sleepSession.delete({ where: { id } });
    return { id };
  }

  // ---- Sources (Apps y Relojes) ----

  getSources(userId: string) {
    return this.prisma.sleepDataSource.findMany({ where: { userId } });
  }

  // Ver nota en ConnectSleepSourceDto: esto NO dispara un diálogo de
  // permisos — solo registra lo que el sistema operativo ya concedió del
  // lado del cliente. Requiere que el cliente haya llamado primero a la API
  // nativa correspondiente (HealthKit en iOS / Health Connect en Android).
  connectSource(userId: string, provider: string, dto: ConnectSleepSourceDto) {
    const anyGranted =
      dto.grantsSleepAnalysis || dto.grantsHeartRate || dto.grantsRespiratoryRate || dto.grantsHrv;

    return this.prisma.sleepDataSource.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        status: anyGranted ? 'conectado' : 'requiere_permiso',
        lastSyncedAt: anyGranted ? new Date() : undefined,
        grantsSleepAnalysis: dto.grantsSleepAnalysis ?? false,
        grantsHeartRate: dto.grantsHeartRate ?? false,
        grantsRespiratoryRate: dto.grantsRespiratoryRate ?? false,
        grantsHrv: dto.grantsHrv ?? false,
      },
      update: {
        status: anyGranted ? 'conectado' : 'requiere_permiso',
        lastSyncedAt: anyGranted ? new Date() : undefined,
        ...(dto.grantsSleepAnalysis !== undefined ? { grantsSleepAnalysis: dto.grantsSleepAnalysis } : {}),
        ...(dto.grantsHeartRate !== undefined ? { grantsHeartRate: dto.grantsHeartRate } : {}),
        ...(dto.grantsRespiratoryRate !== undefined
          ? { grantsRespiratoryRate: dto.grantsRespiratoryRate }
          : {}),
        ...(dto.grantsHrv !== undefined ? { grantsHrv: dto.grantsHrv } : {}),
      },
    });
  }

  async disconnectSource(userId: string, provider: string) {
    const source = await this.prisma.sleepDataSource.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!source) {
      throw new NotFoundException('Sleep data source not found');
    }
    if (source.userId !== userId) {
      throw new ForbiddenException('This data source does not belong to you');
    }

    return this.prisma.sleepDataSource.update({
      where: { userId_provider: { userId, provider } },
      data: { status: 'desvinculado' },
    });
  }

  async resyncSource(userId: string, provider: string) {
    const source = await this.prisma.sleepDataSource.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!source) {
      throw new NotFoundException('Sleep data source not found');
    }
    if (source.status !== 'conectado') {
      throw new ConflictException('This source is not connected');
    }

    return this.prisma.sleepDataSource.update({
      where: { userId_provider: { userId, provider } },
      data: { lastSyncedAt: new Date() },
    });
  }
}
