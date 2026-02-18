import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { SubscriptionService } from './subscription.service.js';
import { RazorpaySubscriptionStatus } from './subscription.entity.js';

@Controller('subscriptions')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.getOrThrow<string>(
      'RAZORPAY_WEBHOOK_SECRET',
    );
  }

  /**
   * Razorpay webhook endpoint.
   * Validates HMAC signature before processing any event.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: string }> {
    // 1. Verify HMAC signature
    if (!signature) {
      throw new BadRequestException('Missing Razorpay signature header');
    }

    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      this.logger.warn('Razorpay webhook signature verification failed');
      throw new ForbiddenException('Invalid webhook signature');
    }

    // 2. Process the event
    const event = body.event as string;
    this.logger.log(`Razorpay webhook event: ${event}`);

    try {
      switch (event) {
        case 'subscription.activated': {
          const subId = body.payload?.subscription?.entity?.id;
          if (subId) {
            await this.subscriptionService.activateSubscription(subId);
          }
          break;
        }

        case 'subscription.charged': {
          // Subscription renewed — extend end_date
          const subId = body.payload?.subscription?.entity?.id;
          if (subId) {
            await this.subscriptionService.activateSubscription(subId);
          }
          break;
        }

        case 'subscription.cancelled': {
          const subId = body.payload?.subscription?.entity?.id;
          if (subId) {
            await this.subscriptionService.deactivateSubscription(
              subId,
              RazorpaySubscriptionStatus.CANCELLED,
            );
          }
          break;
        }

        case 'subscription.paused': {
          const subId = body.payload?.subscription?.entity?.id;
          if (subId) {
            await this.subscriptionService.deactivateSubscription(
              subId,
              RazorpaySubscriptionStatus.PAUSED,
            );
          }
          break;
        }

        case 'subscription.expired': {
          const subId = body.payload?.subscription?.entity?.id;
          if (subId) {
            await this.subscriptionService.deactivateSubscription(
              subId,
              RazorpaySubscriptionStatus.EXPIRED,
            );
          }
          break;
        }

        default:
          this.logger.debug(`Unhandled Razorpay event: ${event}`);
      }
    } catch (error) {
      this.logger.error(`Error processing Razorpay event ${event}: ${error}`);
      // Still return 200 to avoid Razorpay retries for application errors
    }

    return { status: 'ok' };
  }
}
