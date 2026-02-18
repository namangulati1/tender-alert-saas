import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TenderProcessingProcessor,
  TENDER_PROCESSING_QUEUE,
} from './processors/tender-processing.processor.js';
import {
  NotificationProcessor,
  NOTIFICATION_QUEUE,
} from './processors/notification.processor.js';
import { TenderModule } from '../tender/tender.module.js';
import { AiModule } from '../ai/ai.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { UserModule } from '../user/user.module.js';
import { NotificationLog } from '../notification/notification-log.entity.js';

@Module({
  imports: [
    // Register BullMQ with Redis connection from env
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),

    // Register the queues
    BullModule.registerQueue(
      { name: TENDER_PROCESSING_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),

    TypeOrmModule.forFeature([NotificationLog]),

    // Import required modules for processors
    TenderModule,
    AiModule,
    NotificationModule,
    WhatsappModule,
    UserModule,
  ],
  providers: [TenderProcessingProcessor, NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
