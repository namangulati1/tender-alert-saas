import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationLog, DeliveryStatus } from './notification-log.entity.js';
import { UserService } from '../user/user.service.js';
import { NOTIFICATION_QUEUE } from '../queue/processors/notification.processor.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    private readonly userService: UserService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * For a given tender, find all active subscribers and
   * enqueue a notification job for each one.
   */
  async enqueueNotifications(tenderId: string): Promise<number> {
    const activeUsers = await this.userService.findActiveSubscribers();

    if (!activeUsers.length) {
      this.logger.debug('No active subscribers for notifications');
      return 0;
    }

    let enqueued = 0;

    for (const user of activeUsers) {
      try {
        // Create the notification log entry (status: QUEUED)
        const logEntry = this.notificationLogRepo.create({
          user_id: user.id,
          tender_id: tenderId,
          delivery_status: DeliveryStatus.QUEUED,
        });
        const savedLog = await this.notificationLogRepo.save(logEntry);

        // Enqueue the job
        await this.notificationQueue.add(
          'send-notification',
          {
            userId: user.id,
            tenderId,
            notificationLogId: savedLog.id,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );

        enqueued++;
      } catch (error) {
        this.logger.error(
          `Failed to enqueue notification for user ${user.id}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Enqueued ${enqueued}/${activeUsers.length} notifications for tender ${tenderId}`,
    );
    return enqueued;
  }

  /**
   * Get notification history for a user.
   */
  async getUserNotifications(
    userId: string,
    limit = 20,
  ): Promise<NotificationLog[]> {
    return this.notificationLogRepo.find({
      where: { user_id: userId },
      order: { sent_at: 'DESC' },
      take: limit,
      relations: ['tender'],
    });
  }
}
