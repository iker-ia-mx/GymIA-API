import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdherenceService } from '../adherence/adherence.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { EvolutionService } from './evolution.service.js';

@UseGuards(JwtAuthGuard)
@Controller('evolution')
export class EvolutionController {
  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly adherenceService: AdherenceService,
  ) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.evolutionService.getSummary(user.id);
  }

  @Get('strength')
  getStrengthOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.evolutionService.getStrengthOverview(user.id);
  }

  @Get('strength/:exerciseId')
  getExerciseHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.evolutionService.getExerciseHistory(user.id, exerciseId);
  }

  // Motor de Adherencia (docs/ADHERENCE_ENGINE_ARCHITECTURE.md) — mes
  // calendario actual por defecto, sin ventana configurable expuesta
  // todavía (no hay ninguna pantalla del MVP que la necesite).
  @Get('adherence')
  async getAdherence(@CurrentUser() user: AuthenticatedUser) {
    const [overview, currentStreak] = await Promise.all([
      this.adherenceService.getAdherence(user.id),
      this.adherenceService.getCurrentStreak(user.id),
    ]);
    return { ...overview, currentStreak };
  }
}
