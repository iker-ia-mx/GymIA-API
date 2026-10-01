import { Module } from '@nestjs/common';
import { AdherenceService } from './adherence.service.js';

@Module({
  providers: [AdherenceService],
  exports: [AdherenceService],
})
export class AdherenceModule {}
