import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EvolutionController } from './evolution.controller.js';
import { EvolutionService } from './evolution.service.js';

@Module({
  imports: [AuthModule],
  controllers: [EvolutionController],
  providers: [EvolutionService],
})
export class EvolutionModule {}
