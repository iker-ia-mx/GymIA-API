import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { EvolutionService } from './evolution.service.js';

@UseGuards(JwtAuthGuard)
@Controller('evolution')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}

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
}
