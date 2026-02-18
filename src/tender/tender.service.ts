import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Tender } from './tender.entity.js';
import { CreateTenderDto } from './dto/create-tender.dto.js';

@Injectable()
export class TenderService {
  private readonly logger = new Logger(TenderService.name);

  constructor(
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
  ) {}

  /**
   * Generate a SHA256 hash from the tender's source + title + raw_text
   * to ensure deduplication across scraping runs.
   */
  generateHash(source: string, title: string, rawText: string): string {
    return createHash('sha256')
      .update(`${source}|${title}|${rawText}`)
      .digest('hex');
  }

  /**
   * Create a tender if it doesn't already exist (based on hash).
   * Returns { tender, isNew } so the caller knows whether to process it.
   */
  async createIfNotExists(
    dto: CreateTenderDto,
  ): Promise<{ tender: Tender; isNew: boolean }> {
    const hash = this.generateHash(dto.source, dto.title, dto.raw_text);

    const existing = await this.tenderRepo.findOne({ where: { hash } });
    if (existing) {
      this.logger.debug(`Duplicate tender skipped: ${hash}`);
      return { tender: existing, isNew: false };
    }

    const tender = this.tenderRepo.create({
      ...dto,
      hash,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });

    const saved = await this.tenderRepo.save(tender);
    this.logger.log(`New tender saved: ${saved.id} — ${saved.title}`);
    return { tender: saved, isNew: true };
  }

  async findAll(limit = 50, offset = 0): Promise<Tender[]> {
    return this.tenderRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<Tender | null> {
    return this.tenderRepo.findOne({ where: { id } });
  }

  async updateSummary(
    id: string,
    summary: string,
    extracted?: {
      state?: string;
      category?: string;
      budget?: number;
      deadline?: Date;
    },
  ): Promise<Tender> {
    const tender = await this.tenderRepo.findOneOrFail({ where: { id } });
    tender.summary = summary;

    if (extracted) {
      if (extracted.state) tender.state = extracted.state;
      if (extracted.category) tender.category = extracted.category;
      if (extracted.budget) tender.budget = extracted.budget;
      if (extracted.deadline) tender.deadline = extracted.deadline;
    }

    return this.tenderRepo.save(tender);
  }

  async findRecent(hours = 24): Promise<Tender[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.tenderRepo
      .createQueryBuilder('tender')
      .where('tender.created_at >= :since', { since })
      .orderBy('tender.created_at', 'DESC')
      .getMany();
  }
}
