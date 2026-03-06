import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiTestController } from './ai-test.controller.js';

@Module({
  providers: [AiService],
  controllers: [AiTestController],
  exports: [AiService],
})
export class AiModule {}
