import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService, StructuredExtraction } from './ai.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

interface SummarizeRequest {
  text: string;
}

interface ExtractRequest {
  text: string;
}

interface SummarizeResponse {
  summary: string;
}

interface ExtractResponse {
  extraction: StructuredExtraction;
}

@Controller('ai-test')
@UseGuards(JwtAuthGuard)
export class AiTestController {
  constructor(private readonly aiService: AiService) {}

  @Post('summarize')
  async summarize(@Body() dto: SummarizeRequest): Promise<SummarizeResponse> {
    const summary = await this.aiService.summarize(dto.text);
    return { summary };
  }

  @Post('extract')
  async extract(@Body() dto: ExtractRequest): Promise<ExtractResponse> {
    const extraction = await this.aiService.extractStructured(dto.text);
    return { extraction };
  }
}
