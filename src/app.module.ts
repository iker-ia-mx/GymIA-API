import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';
import { EvolutionModule } from './evolution/evolution.module.js';
import { BodyCompositionModule } from './body-composition/body-composition.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkoutsModule,
    EvolutionModule,
    BodyCompositionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
