import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { BodyCompositionService } from './body-composition.service.js';
import { CreateBodyMetricDto } from './dto/create-body-metric.dto.js';
import { CreateProgressPhotoDto } from './dto/create-progress-photo.dto.js';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class BodyCompositionController {
  constructor(private readonly bodyCompositionService: BodyCompositionService) {}

  // ---- BodyMetric ----

  @Post('body-metrics')
  createBodyMetric(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBodyMetricDto) {
    return this.bodyCompositionService.createBodyMetric(user.id, dto);
  }

  @Get('body-metrics')
  getBodyMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.bodyCompositionService.getBodyMetrics(user.id);
  }

  @Get('body-metrics/latest')
  getLatestBodyMetric(@CurrentUser() user: AuthenticatedUser) {
    return this.bodyCompositionService.getLatestBodyMetric(user.id);
  }

  @Delete('body-metrics/:id')
  deleteBodyMetric(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bodyCompositionService.deleteBodyMetric(user.id, id);
  }

  // ---- ProgressPhoto ----

  @Post('progress-photos/upload-url')
  createUploadUrl(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadUrlDto) {
    return this.bodyCompositionService.createUploadUrl(user.id, dto);
  }

  @Post('progress-photos')
  createProgressPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProgressPhotoDto,
  ) {
    return this.bodyCompositionService.createProgressPhoto(user.id, dto);
  }

  @Get('progress-photos')
  getProgressPhotos(@CurrentUser() user: AuthenticatedUser) {
    return this.bodyCompositionService.getProgressPhotos(user.id);
  }

  @Delete('progress-photos/:id')
  deleteProgressPhoto(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bodyCompositionService.deleteProgressPhoto(user.id, id);
  }
}
