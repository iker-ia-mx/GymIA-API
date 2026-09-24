import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { CreateRoutineDto } from './dto/create-routine.dto.js';
import { UpdateSetDto } from './dto/update-set.dto.js';
import { WorkoutsService } from './workouts.service.js';

@UseGuards(JwtAuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get('exercises')
  getExercises() {
    return this.workoutsService.getExercises();
  }

  @Get('routines')
  getRoutines(@CurrentUser() user: AuthenticatedUser) {
    return this.workoutsService.getRoutines(user.id);
  }

  @Post('routines')
  createRoutine(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoutineDto) {
    return this.workoutsService.createRoutine(user.id, dto);
  }

  @Get('sessions/active')
  getActiveSession(@CurrentUser() user: AuthenticatedUser) {
    return this.workoutsService.getActiveSession(user.id);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workoutsService.getSession(user.id, id);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  startSession(@CurrentUser() user: AuthenticatedUser, @Body('routineId') routineId: string) {
    return this.workoutsService.startSession(user.id, routineId);
  }

  @Post('sessions/:id/exercises/:sessionExerciseId/sets')
  @HttpCode(HttpStatus.CREATED)
  addSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Param('sessionExerciseId') sessionExerciseId: string,
  ) {
    return this.workoutsService.addSet(user.id, sessionId, sessionExerciseId);
  }

  @Patch('sessions/:id/sets/:setLogId')
  updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Param('setLogId') setLogId: string,
    @Body() dto: UpdateSetDto,
  ) {
    return this.workoutsService.updateSet(user.id, sessionId, setLogId, dto);
  }

  @Post('sessions/:id/finish')
  finishSession(@CurrentUser() user: AuthenticatedUser, @Param('id') sessionId: string) {
    return this.workoutsService.finishSession(user.id, sessionId);
  }
}
