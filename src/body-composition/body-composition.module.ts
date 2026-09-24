import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BodyCompositionController } from './body-composition.controller.js';
import { BodyCompositionService } from './body-composition.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BodyCompositionController],
  providers: [BodyCompositionService],
})
export class BodyCompositionModule {}
