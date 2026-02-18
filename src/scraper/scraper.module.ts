import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScraperService } from './scraper.service.js';
import { ExampleScraper } from './scrapers/example.scraper.js';
import { TenderModule } from '../tender/tender.module.js';
import { TENDER_PROCESSING_QUEUE } from '../queue/processors/tender-processing.processor.js';

@Module({
  imports: [
    TenderModule,
    BullModule.registerQueue({ name: TENDER_PROCESSING_QUEUE }),
  ],
  providers: [ScraperService, ExampleScraper],
  exports: [ScraperService],
})
export class ScraperModule {}
