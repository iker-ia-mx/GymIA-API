import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';
import { EvolutionModule } from './evolution/evolution.module.js';
import { BodyCompositionModule } from './body-composition/body-composition.module.js';
import { NutritionModule } from './nutrition/nutrition.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { SleepModule } from './sleep/sleep.module.js';
import { SquadModule } from './squad/squad.module.js';
import { CoachModule } from './coach/coach.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    WorkoutsModule,
    EvolutionModule,
    BodyCompositionModule,
    NutritionModule,
    OnboardingModule,
    SleepModule,
    SquadModule,
    CoachModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
