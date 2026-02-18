import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenderService } from '../tender/tender.service.js';
import { ExampleScraper, ScrapedTender } from './scrapers/example.scraper.js';
import { TENDER_PROCESSING_QUEUE } from '../queue/processors/tender-processing.processor.js';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly tenderService: TenderService,
    private readonly exampleScraper: ExampleScraper,
    @InjectQueue(TENDER_PROCESSING_QUEUE)
    private readonly tenderQueue: Queue,
  ) {}

  /**
   * Cron job that runs every 6 hours.
   * Fetches tenders from all configured scrapers,
   * deduplicates, saves new ones, and pushes them to the processing queue.
   */
  @Cron(CronExpression.EVERY_6_HOURS, { name: 'tender-scraper' })
  async handleCron(): Promise<void> {
    this.logger.log('Starting tender scraping cycle...');
    const startTime = Date.now();

    try {
      // Gather tenders from all scrapers
      const allTenders = await this.runAllScrapers();
      this.logger.log(`Fetched ${allTenders.length} tenders from all sources`);

      let newCount = 0;
      let duplicateCount = 0;

      for (const tender of allTenders) {
        try {
          const { tender: savedTender, isNew } =
            await this.tenderService.createIfNotExists({
              source: tender.source,
              title: tender.title,
              raw_text: tender.raw_text,
              state: tender.state,
              category: tender.category,
              budget: tender.budget,
              deadline: tender.deadline,
            });

          if (isNew) {
            // Push to processing queue for AI summarization + notifications
            await this.tenderQueue.add(
              'process-tender',
              { tenderId: savedTender.id },
              {
                attempts: 3,
                backoff: { type: 'exponential', delay: 3000 },
                removeOnComplete: 100,
                removeOnFail: 500,
              },
            );
            newCount++;
          } else {
            duplicateCount++;
          }
        } catch (error) {
          this.logger.error(`Error processing scraped tender: ${error}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Scraping cycle complete in ${duration}s — New: ${newCount}, Duplicates: ${duplicateCount}`,
      );
    } catch (error) {
      this.logger.error(`Scraping cycle failed: ${error}`);
    }
  }

  /**
   * Run all registered scrapers and combine results.
   * Add more scrapers here as they are implemented.
   */
  private async runAllScrapers(): Promise<ScrapedTender[]> {
    const results: ScrapedTender[] = [];

    try {
      const exampleResults = await this.exampleScraper.scrape();
      results.push(...exampleResults);
    } catch (error) {
      this.logger.error(`Example scraper failed: ${error}`);
    }

    // Add more scrapers:
    // try {
    //   const gemResults = await this.gemScraper.scrape();
    //   results.push(...gemResults);
    // } catch (error) {
    //   this.logger.error(`GEM scraper failed: ${error}`);
    // }

    return results;
  }
}
