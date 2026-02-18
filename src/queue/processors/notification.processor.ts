import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappService } from '../../whatsapp/whatsapp.service.js';
import {
  NotificationLog,
  DeliveryStatus,
} from '../../notification/notification-log.entity.js';
import { TenderService } from '../../tender/tender.service.js';
import { UserService } from '../../user/user.service.js';

export const NOTIFICATION_QUEUE = 'notification';

export interface NotificationJobData {
  userId: string;
  tenderId: string;
  notificationLogId: string;
}

@Processor(NOTIFICATION_QUEUE, {
  concurrency: 5,
  limiter: { max: 30, duration: 60000 },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly tenderService: TenderService,
    private readonly userService: UserService,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { userId, tenderId, notificationLogId } = job.data;
    this.logger.log(
      `Sending notification — user: ${userId}, tender: ${tenderId}`,
    );

    try {
      const [user, tender] = await Promise.all([
        this.userService.findById(userId),
        this.tenderService.findById(tenderId),
      ]);

      if (!user || !tender) {
        this.logger.warn(`User or tender not found, skipping notification`);
        await this.updateNotificationStatus(
          notificationLogId,
          DeliveryStatus.FAILED,
        );
        return;
      }

      // Build the message
      const message = this.buildTenderMessage(tender);

      // Send via WhatsApp
      await this.whatsappService.sendMessage({
        to: user.phone,
        text: message,
      });

      // Update notification status
      await this.updateNotificationStatus(
        notificationLogId,
        DeliveryStatus.SENT,
      );

      this.logger.log(
        `Notification sent to ${user.phone} for tender ${tenderId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error}`);
      await this.updateNotificationStatus(
        notificationLogId,
        DeliveryStatus.FAILED,
      );
      throw error; // Let BullMQ handle retries
    }
  }

  private buildTenderMessage(tender: any): string {
    const lines = [`📋 *New Tender Alert*`, ``, `*${tender.title}*`, ``];

    if (tender.summary) {
      lines.push(tender.summary, '');
    }

    if (tender.category) lines.push(`📂 Category: ${tender.category}`);
    if (tender.state) lines.push(`📍 State: ${tender.state}`);
    if (tender.budget)
      lines.push(
        `💰 Budget: ₹${Number(tender.budget).toLocaleString('en-IN')}`,
      );
    if (tender.deadline) {
      lines.push(
        `⏰ Deadline: ${new Date(tender.deadline).toLocaleDateString('en-IN')}`,
      );
    }

    lines.push('', `🔗 Source: ${tender.source}`);
    return lines.join('\n');
  }

  private async updateNotificationStatus(
    id: string,
    status: DeliveryStatus,
  ): Promise<void> {
    await this.notificationLogRepo.update(id, { delivery_status: status });
  }
}
