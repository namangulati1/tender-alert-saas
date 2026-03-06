import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { UserModule } from './user/user.module.js';
import { TenderModule } from './tender/tender.module.js';
import { ScraperModule } from './scraper/scraper.module.js';
import { AiModule } from './ai/ai.module.js';
import { QueueModule } from './queue/queue.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { SubscriptionModule } from './subscription/subscription.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GlobalAuthGuard } from './auth/global-auth.guard.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    // Global configuration from .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // PostgreSQL connection via TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USER'),
        password: configService.getOrThrow<string>('DB_PASS'),
        database: configService.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // Cron scheduling
    ScheduleModule.forRoot(),

    // Feature modules
    UserModule,
    TenderModule,
    ScraperModule,
    AiModule,
    QueueModule,
    NotificationModule,
    WhatsappModule,
    SubscriptionModule,
    AuthModule,
    DatabaseModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
