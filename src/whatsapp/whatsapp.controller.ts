/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken: string;

  constructor(private readonly configService: ConfigService) {
    this.verifyToken = this.configService.getOrThrow<string>(
      'WHATSAPP_VERIFY_TOKEN',
    );
  }

  /**
   * Webhook verification endpoint (GET).
   * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
   */
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
      return;
    }
    this.logger.warn('WhatsApp webhook verification failed');
    throw new ForbiddenException('Verification failed');
  }

  /**
   * Incoming message handler (POST).
   * Receives incoming messages and status updates from WhatsApp.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  handleIncomingMessage(@Body() body: any): { status: string } {
    try {
      const entries = body?.entry;
      if (!entries?.length) {
        return { status: 'no entries' };
      }

      for (const entry of entries) {
        const changes = entry?.changes;
        if (!changes?.length) continue;

        for (const change of changes) {
          const value = change?.value;

          // Handle incoming messages
          if (value?.messages?.length) {
            for (const message of value.messages) {
              this.logger.log(
                `Incoming message from ${message.from}: ${message.type}`,
              );
              // TODO: Add custom logic for incoming messages
              // e.g., auto-reply, command parsing, subscription management
            }
          }

          // Handle status updates
          if (value?.statuses?.length) {
            for (const status of value.statuses) {
              this.logger.debug(
                `Message ${status.id} status: ${status.status}`,
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing incoming message: ${error}`);
    }

    return { status: 'ok' };
  }
}
