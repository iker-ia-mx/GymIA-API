import { Module } from '@nestjs/common';
import { AdherenceModule } from '../adherence/adherence.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EvolutionModule } from '../evolution/evolution.module.js';
import { SquadAccessService } from './squad-access.service.js';
import { SquadController } from './squad.controller.js';
import { SquadService } from './squad.service.js';

@Module({
  imports: [AuthModule, EvolutionModule, AdherenceModule],
  controllers: [SquadController],
  providers: [SquadAccessService, SquadService],
  exports: [SquadAccessService],
})
export class SquadModule {}
