import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenderService } from '../../tender/tender.service.js';
import { AiService } from '../../ai/ai.service.js';
import { NotificationService } from '../../notification/notification.service.js';
export const TENDER_PROCESSING_QUEUE = 'tender-processing';

export interface TenderProcessingJobData {
  tenderId: string;
}

@Processor(TENDER_PROCESSING_QUEUE, {
  concurrency: 3,
  limiter: { max: 10, duration: 60000 },
})
export class TenderProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TenderProcessingProcessor.name);

  constructor(
    private readonly tenderService: TenderService,
    private readonly aiService: AiService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<TenderProcessingJobData>): Promise<void> {
    const { tenderId } = job.data;
    this.logger.log(`Processing tender: ${tenderId}`);

    try {
      // 1. Fetch the tender
      const tender = await this.tenderService.findById(tenderId);
      if (!tender) {
        this.logger.warn(`Tender ${tenderId} not found, skipping`);
        return;
      }

      // 2. AI Summarization
      const summary = await this.aiService.summarize(tender.raw_text);

      // 3. Structured extraction
      const extracted = await this.aiService.extractStructured(tender.raw_text);

      // 4. Update the tender with AI results
      await this.tenderService.updateSummary(tenderId, summary, {
        state: extracted.state ?? undefined,
        category: extracted.category ?? undefined,
        budget: extracted.budget ?? undefined,
        deadline: extracted.deadline ? new Date(extracted.deadline) : undefined,
      });

      // 5. Enqueue notifications for active subscribers
      await this.notificationService.enqueueNotifications(tenderId);

      this.logger.log(`Tender ${tenderId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process tender ${tenderId}: ${error}`);
      throw error; // Let BullMQ handle retries
    }
  }
}
