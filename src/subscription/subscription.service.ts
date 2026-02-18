import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Subscription,
  RazorpaySubscriptionStatus,
} from './subscription.entity.js';
import { UserService } from '../user/user.service.js';
import { SubscriptionStatus } from '../user/user.entity.js';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new subscription record when Razorpay subscription is created.
   */
  async createSubscription(
    userId: string,
    razorpaySubscriptionId: string,
  ): Promise<Subscription> {
    const user = await this.userService.findById(userId);

    const subscription = this.subscriptionRepo.create({
      user_id: user.id,
      razorpay_subscription_id: razorpaySubscriptionId,
      status: RazorpaySubscriptionStatus.CREATED,
    });

    const saved = await this.subscriptionRepo.save(subscription);
    this.logger.log(
      `Subscription created for user ${userId}: ${razorpaySubscriptionId}`,
    );
    return saved;
  }

  /**
   * Activate a subscription after payment verification.
   */
  async activateSubscription(
    razorpaySubscriptionId: string,
  ): Promise<Subscription> {
    const subscription = await this.findByRazorpayId(razorpaySubscriptionId);

    subscription.status = RazorpaySubscriptionStatus.ACTIVE;
    subscription.start_date = new Date();
    // Default to 30 days from now
    subscription.end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const saved = await this.subscriptionRepo.save(subscription);

    // Also update the user's subscription status
    await this.userService.updateSubscriptionStatus(
      subscription.user_id,
      SubscriptionStatus.ACTIVE,
    );

    this.logger.log(`Subscription activated: ${razorpaySubscriptionId}`);
    return saved;
  }

  /**
   * Handle subscription cancellation/expiry.
   */
  async deactivateSubscription(
    razorpaySubscriptionId: string,
    status:
      | RazorpaySubscriptionStatus.CANCELLED
      | RazorpaySubscriptionStatus.EXPIRED
      | RazorpaySubscriptionStatus.PAUSED,
  ): Promise<Subscription> {
    const subscription = await this.findByRazorpayId(razorpaySubscriptionId);

    subscription.status = status;
    if (
      status === RazorpaySubscriptionStatus.CANCELLED ||
      status === RazorpaySubscriptionStatus.EXPIRED
    ) {
      subscription.end_date = new Date();
    }

    const saved = await this.subscriptionRepo.save(subscription);

    // Update user's subscription status
    const userStatus =
      status === RazorpaySubscriptionStatus.PAUSED
        ? SubscriptionStatus.ACTIVE // Paused still counts as active until fully cancelled
        : SubscriptionStatus.EXPIRED;

    await this.userService.updateSubscriptionStatus(
      subscription.user_id,
      userStatus,
    );

    this.logger.log(`Subscription ${status}: ${razorpaySubscriptionId}`);
    return saved;
  }

  async findByRazorpayId(
    razorpaySubscriptionId: string,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { razorpay_subscription_id: razorpaySubscriptionId },
    });
    if (!subscription) {
      throw new NotFoundException(
        `Subscription not found: ${razorpaySubscriptionId}`,
      );
    }
    return subscription;
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }
}
