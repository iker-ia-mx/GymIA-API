import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { ConnectSleepSourceDto } from './dto/connect-sleep-source.dto.js';
import { ImportSleepSessionDto } from './dto/import-sleep-session.dto.js';
import { SleepService } from './sleep.service.js';

@UseGuards(JwtAuthGuard)
@Controller('sleep')
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  // ---- Sessions ----

  @Post('sessions')
  importSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportSleepSessionDto) {
    return this.sleepService.importSession(user.id, dto);
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sleepService.getSessions(user.id);
  }

  @Get('sessions/latest')
  getLatestSession(@CurrentUser() user: AuthenticatedUser) {
    return this.sleepService.getLatestSession(user.id);
  }

  @Get('sessions/:id')
  getSessionById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sleepService.getSessionById(user.id, id);
  }

  @Delete('sessions/:id')
  deleteSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sleepService.deleteSession(user.id, id);
  }

  // ---- Sources ----

  @Get('sources')
  getSources(@CurrentUser() user: AuthenticatedUser) {
    return this.sleepService.getSources(user.id);
  }

  @Post('sources/:provider/connect')
  connectSource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
    @Body() dto: ConnectSleepSourceDto,
  ) {
    return this.sleepService.connectSource(user.id, provider, dto);
  }

  @Post('sources/:provider/disconnect')
  disconnectSource(@CurrentUser() user: AuthenticatedUser, @Param('provider') provider: string) {
    return this.sleepService.disconnectSource(user.id, provider);
  }

  @Post('sources/:provider/resync')
  resyncSource(@CurrentUser() user: AuthenticatedUser, @Param('provider') provider: string) {
    return this.sleepService.resyncSource(user.id, provider);
  }
}
