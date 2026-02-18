/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface StructuredExtraction {
  state: string | null;
  category: string | null;
  budget: number | null;
  deadline: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  /**
   * Generate a concise 4-line summary of the tender text.
   */
  async summarize(rawText: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a government tender analyst. Summarize the following tender in exactly 4 lines. ' +
              'Line 1: What is being tendered. ' +
              'Line 2: Issuing authority and location. ' +
              'Line 3: Budget/estimated cost if mentioned. ' +
              'Line 4: Submission deadline and key dates.',
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const summary = response.choices[0]?.message?.content?.trim() ?? '';
      this.logger.debug(`Summary generated (${summary.length} chars)`);
      return summary;
    } catch (error) {
      this.logger.error(`AI summarization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract structured fields from the raw tender text.
   */
  async extractStructured(rawText: string): Promise<StructuredExtraction> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Extract the following fields from the tender text and return them as JSON: ' +
              '{ "state": "<state/region>", "category": "<tender category>", ' +
              '"budget": <number or null>, "deadline": "<ISO date string or null>" }. ' +
              'Return ONLY valid JSON, no explanation.',
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '{}';
      const parsed: StructuredExtraction = JSON.parse(content);
      this.logger.debug(`Structured extraction completed`);
      return parsed;
    } catch (error) {
      this.logger.error(`Structured extraction failed: ${error}`);
      return { state: null, category: null, budget: null, deadline: null };
    }
  }
}
