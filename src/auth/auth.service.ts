import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, SubscriptionStatus } from '../user/user.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    phone: string;
    plan_type: string;
    subscription_status: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with phone ${dto.phone} already exists`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = this.userRepo.create({
      phone: dto.phone,
      password: hashedPassword,
      plan_type: dto.plan_type,
      subscription_status: SubscriptionStatus.INACTIVE,
    });

    const savedUser = await this.userRepo.save(user);
    this.logger.log(`User registered: ${savedUser.id} (${savedUser.phone})`);

    const token = this.generateToken(savedUser);

    return {
      access_token: token,
      user: {
        id: savedUser.id,
        phone: savedUser.phone,
        plan_type: savedUser.plan_type,
        subscription_status: savedUser.subscription_status,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Password not set for this user');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user.id} (${user.phone})`);

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        phone: user.phone,
        plan_type: user.plan_type,
        subscription_status: user.subscription_status,
      },
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }
}
