import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SleepController } from './sleep.controller.js';
import { SleepService } from './sleep.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SleepController],
  providers: [SleepService],
})
export class SleepModule {}
