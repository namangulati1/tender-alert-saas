import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { User, PlanType, SubscriptionStatus } from '../../user/user.entity.js';
import { Tender } from '../../tender/tender.entity.js';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
  ) {}

  async onModuleInit(): Promise<void> {
    const shouldSeed = process.env.SEED_DATABASE === 'true';
    if (!shouldSeed) {
      this.logger.log(
        'Database seeding skipped (set SEED_DATABASE=true to enable)',
      );
      return;
    }

    this.logger.log('Starting database seeding...');
    await this.seedUsers();
    await this.seedTenders();
    this.logger.log('Database seeding completed!');
  }

  private async seedUsers(): Promise<void> {
    const count = await this.userRepo.count();
    if (count > 0) {
      this.logger.log(
        `Users table already has ${count} records, skipping user seed`,
      );
      return;
    }

    const users = [
      {
        phone: '+919876543210',
        password: await bcrypt.hash('password123', this.SALT_ROUNDS),
        plan_type: PlanType.PREMIUM,
        subscription_status: SubscriptionStatus.ACTIVE,
      },
      {
        phone: '+919876543211',
        password: await bcrypt.hash('password123', this.SALT_ROUNDS),
        plan_type: PlanType.BASIC,
        subscription_status: SubscriptionStatus.ACTIVE,
      },
      {
        phone: '+919876543212',
        password: await bcrypt.hash('password123', this.SALT_ROUNDS),
        plan_type: PlanType.FREE,
        subscription_status: SubscriptionStatus.INACTIVE,
      },
      {
        phone: '+919876543213',
        password: await bcrypt.hash('password123', this.SALT_ROUNDS),
        plan_type: PlanType.PREMIUM,
        subscription_status: SubscriptionStatus.EXPIRED,
      },
    ];

    for (const userData of users) {
      const user = this.userRepo.create(userData);
      await this.userRepo.save(user);
      this.logger.log(`Created user: ${user.phone} (${user.plan_type})`);
    }

    this.logger.log(`Seeded ${users.length} users`);
  }

  private async seedTenders(): Promise<void> {
    const count = await this.tenderRepo.count();
    if (count > 0) {
      this.logger.log(
        `Tenders table already has ${count} records, skipping tender seed`,
      );
      return;
    }

    const tenders = [
      {
        source: 'GEM Portal',
        external_id: 'GEM/2024/1234',
        hash: createHash('sha256').update('GEM/2024/1234').digest('hex'),
        title: 'Supply of Computer Hardware and Peripherals',
        raw_text:
          'Government e-Marketplace tender for supply of computer hardware including laptops, desktops, printers, and networking equipment for various government offices in Delhi NCR region.',
        summary:
          'Computer hardware supply tender for Delhi NCR government offices',
        state: 'Delhi',
        category: 'IT Equipment',
        budget: 2500000,
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      },
      {
        source: 'Central Public Works Department',
        external_id: 'CPWD/2024/5678',
        hash: createHash('sha256').update('CPWD/2024/5678').digest('hex'),
        title: 'Construction of Office Building',
        raw_text:
          'CPWD invites bids for construction of a 5-story office building with modern amenities, parking facilities, and green building certification in Mumbai.',
        summary: 'Office building construction project in Mumbai',
        state: 'Maharashtra',
        category: 'Construction',
        budget: 15000000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      {
        source: 'State Transport Department',
        external_id: 'STD/2024/9012',
        hash: createHash('sha256').update('STD/2024/9012').digest('hex'),
        title: 'Procurement of Electric Buses',
        raw_text:
          'Tender for procurement of 50 electric buses for city transport services including charging infrastructure and 5-year maintenance contract.',
        summary: 'Electric bus procurement for city transport',
        state: 'Karnataka',
        category: 'Transportation',
        budget: 50000000,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      },
      {
        source: 'Municipal Corporation',
        external_id: 'MC/2024/3456',
        hash: createHash('sha256').update('MC/2024/3456').digest('hex'),
        title: 'Waste Management System Implementation',
        raw_text:
          'Implementation of smart waste management system including IoT sensors, GPS tracking, and automated collection scheduling for the entire city.',
        summary: 'Smart waste management system implementation',
        state: 'Tamil Nadu',
        category: 'Smart City',
        budget: 8000000,
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
      },
      {
        source: 'National Health Mission',
        external_id: 'NHM/2024/7890',
        hash: createHash('sha256').update('NHM/2024/7890').digest('hex'),
        title: 'Medical Equipment Supply for District Hospitals',
        raw_text:
          'Supply and installation of advanced medical equipment including MRI machines, CT scanners, and ventilators for 10 district hospitals.',
        summary: 'Medical equipment supply for district hospitals',
        state: 'Uttar Pradesh',
        category: 'Healthcare',
        budget: 35000000,
        deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
      },
    ];

    for (const tenderData of tenders) {
      const tender = this.tenderRepo.create(tenderData);
      await this.tenderRepo.save(tender);
      this.logger.log(`Created tender: ${tender.title} (${tender.state})`);
    }

    this.logger.log(`Seeded ${tenders.length} tenders`);
  }
}
