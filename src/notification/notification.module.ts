import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationLog } from './notification-log.entity.js';
import { NotificationService } from './notification.service.js';
import { UserModule } from '../user/user.module.js';
import { NOTIFICATION_QUEUE } from '../queue/processors/notification.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLog]),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    UserModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
