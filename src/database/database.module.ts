import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seeds/seed.service.js';
import { User } from '../user/user.entity.js';
import { Tender } from '../tender/tender.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tender])],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
