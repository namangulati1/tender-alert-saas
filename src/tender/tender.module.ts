import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tender } from './tender.entity.js';
import { TenderService } from './tender.service.js';
import { TenderController } from './tender.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Tender])],
  controllers: [TenderController],
  providers: [TenderService],
  exports: [TenderService],
})
export class TenderModule {}
