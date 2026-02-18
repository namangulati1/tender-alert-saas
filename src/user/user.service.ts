import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SubscriptionStatus } from './user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        `User with phone ${dto.phone} already exists`,
      );
    }

    const user = this.userRepo.create(dto);
    const saved = await this.userRepo.save(user);
    this.logger.log(`User created: ${saved.id} (${saved.phone})`);
    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  async findActiveSubscribers(): Promise<User[]> {
    return this.userRepo.find({
      where: { subscription_status: SubscriptionStatus.ACTIVE },
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    const updated = await this.userRepo.save(user);
    this.logger.log(`User updated: ${updated.id}`);
    return updated;
  }

  async updateSubscriptionStatus(
    id: string,
    status: SubscriptionStatus,
  ): Promise<User> {
    const user = await this.findById(id);
    user.subscription_status = status;
    return this.userRepo.save(user);
  }
}
