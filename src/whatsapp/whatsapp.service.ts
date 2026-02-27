/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface WhatsAppMessagePayload {
  to: string;
  text: string;
}

export interface WhatsAppTemplatePayload {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly httpClient: AxiosInstance;
  private readonly phoneNumberId: string;

  constructor(private readonly configService: ConfigService) {
    this.phoneNumberId = this.configService.getOrThrow<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );
    const accessToken = this.configService.getOrThrow<string>(
      'WHATSAPP_ACCESS_TOKEN',
    );

    this.httpClient = axios.create({
      baseURL: `https://graph.facebook.com/v22.0/${this.phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Send a plain text message via WhatsApp Cloud API.
   */
  async sendMessage(payload: WhatsAppMessagePayload): Promise<void> {
    try {
      await this.httpClient.post('/messages', {
        messaging_product: 'whatsapp',
        to: payload.to,
        type: 'text',
        text: { body: payload.text },
      });
      this.logger.log(`Message sent to ${payload.to}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send message to ${payload.to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Send a template message via WhatsApp Cloud API.
   */
  async sendTemplate(payload: WhatsAppTemplatePayload): Promise<void> {
    try {
      const body: any = {
        messaging_product: 'whatsapp',
        to: payload.to,
        type: 'template',
        template: {
          name: payload.templateName,
          language: { code: payload.languageCode },
        },
      };

      if (payload.components?.length) {
        body.template.components = payload.components;
      }

      await this.httpClient.post('/messages', body);
      this.logger.log(
        `Template "${payload.templateName}" sent to ${payload.to}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send template to ${payload.to}: ${error.message}`,
      );
      throw error;
    }
  }
}
