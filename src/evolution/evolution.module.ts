import { Module } from '@nestjs/common';
import { AdherenceModule } from '../adherence/adherence.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EvolutionController } from './evolution.controller.js';
import { EvolutionService } from './evolution.service.js';

@Module({
  imports: [AuthModule, AdherenceModule],
  controllers: [EvolutionController],
  providers: [EvolutionService],
  exports: [EvolutionService],
})
export class EvolutionModule {}
