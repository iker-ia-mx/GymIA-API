import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { CompleteOnboardingDto, UpdateOnboardingProfileDto } from './dto/complete-onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getProfile(user.id);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  complete(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompleteOnboardingDto) {
    return this.onboardingService.complete(user.id, dto);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOnboardingProfileDto) {
    return this.onboardingService.updateProfile(user.id, dto);
  }
}
