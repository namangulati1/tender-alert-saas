/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';

export interface StructuredExtraction {
  state: string | null;
  category: string | null;
  budget: number | null;
  deadline: string | null;
}

export enum AiProvider {
  GEMINI = 'gemini', // FREE: 1500 requests/day
  GROQ = 'groq', // FREE: 14,400 requests/day (20/min)
  OPENROUTER = 'openrouter', // FREE: Various models available
  OPENAI = 'openai', // PAID: Pay per use
  ANTHROPIC = 'anthropic', // PAID: Pay per use
  LOCAL = 'local', // FREE: Rule-based fallback
}

interface AiResponse {
  content: string;
  provider: AiProvider;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiClient: OpenAI | null;
  private readonly primaryModel: string;
  private readonly fallbackEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openaiClient =
      openaiKey && openaiKey !== 'your_openai_api_key'
        ? new OpenAI({ apiKey: openaiKey })
        : null;

    this.primaryModel = this.configService.get<string>(
      'OPENAI_MODEL',
      'gpt-4o-mini',
    );
    this.fallbackEnabled = this.configService.get<boolean>(
      'AI_FALLBACK_ENABLED',
      true,
    );
  }

  /**
   * Generate a concise 4-line summary of the tender text.
   * Tries multiple providers in order: OpenAI -> Anthropic -> Gemini -> Local
   */
  async summarize(rawText: string): Promise<string> {
    const prompt = `You are a government tender analyst. Summarize the following tender in exactly 4 lines.
Line 1: What is being tendered.
Line 2: Issuing authority and location.
Line 3: Budget/estimated cost if mentioned.
Line 4: Submission deadline and key dates.

Tender text:
${rawText}`;

    try {
      const response = await this.tryProviders(prompt, 300);
      this.logger.log(
        `Summary generated using ${response.provider} (${response.content.length} chars)`,
      );
      return response.content;
    } catch (error) {
      this.logger.error(`All AI providers failed for summarization: ${error}`);
      return this.generateLocalSummary(rawText);
    }
  }

  /**
   * Extract structured fields from the raw tender text.
   */
  async extractStructured(rawText: string): Promise<StructuredExtraction> {
    const prompt = `Extract the following fields from the tender text and return them as JSON:
{ "state": "<state/region>", "category": "<tender category>", "budget": <number or null>, "deadline": "<ISO date string or null>" }
Return ONLY valid JSON, no explanation.

Tender text:
${rawText}`;

    try {
      const response = await this.tryProviders(prompt, 200);
      this.logger.log(`Extraction completed using ${response.provider}`);

      const content = response.content.trim();
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ||
        content.match(/```\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      const parsed: StructuredExtraction = JSON.parse(jsonStr);
      return {
        state: parsed.state || null,
        category: parsed.category || null,
        budget: typeof parsed.budget === 'number' ? parsed.budget : null,
        deadline: parsed.deadline || null,
      };
    } catch (error) {
      this.logger.error(`All AI providers failed for extraction: ${error}`);
      return this.extractLocal(rawText);
    }
  }

  /**
   * Try multiple AI providers in sequence until one succeeds.
   */
  private async tryProviders(
    prompt: string,
    maxTokens: number,
  ): Promise<AiResponse> {
    const providers = this.getProviderOrder();

    for (const provider of providers) {
      try {
        const response = await this.callProvider(provider, prompt, maxTokens);
        if (response) {
          return { content: response, provider };
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider} failed: ${error}`);
        continue;
      }
    }

    throw new Error('All AI providers exhausted');
  }

  /**
   * Get the order of providers to try based on configuration.
   */
  private getProviderOrder(): AiProvider[] {
    const customOrder = this.configService.get<string>('AI_PROVIDER_ORDER');
    if (customOrder) {
      return customOrder.split(',').map((p) => p.trim() as AiProvider);
    }
    // Default: Try free providers first, then paid, then local
    return [
      AiProvider.GROQ, // FREE: 14,400 req/day
      AiProvider.GEMINI, // FREE: 1,500 req/day
      AiProvider.OPENROUTER, // FREE tier available
      AiProvider.OPENAI, // PAID
      AiProvider.ANTHROPIC, // PAID
      AiProvider.LOCAL, // FREE fallback
    ];
  }

  /**
   * Call a specific AI provider.
   */
  private async callProvider(
    provider: AiProvider,
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    switch (provider) {
      case AiProvider.GROQ:
        return this.callGroq(prompt, maxTokens);
      case AiProvider.GEMINI:
        return this.callGemini(prompt, maxTokens);
      case AiProvider.OPENROUTER:
        return this.callOpenRouter(prompt, maxTokens);
      case AiProvider.OPENAI:
        return this.callOpenAI(prompt, maxTokens);
      case AiProvider.ANTHROPIC:
        return this.callAnthropic(prompt, maxTokens);
      case AiProvider.LOCAL:
        return null; // Local is handled as final fallback
      default:
        return null;
    }
  }

  /**
   * Call Groq API (FREE tier: 14,400 requests/day, 20/min).
   * Sign up at: https://console.groq.com
   */
  private async callGroq(
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant', // Fast, good quality, free tier
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const content = response.data.choices[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : null;
  }

  /**
   * Call OpenRouter API (FREE tier available).
   * Sign up at: https://openrouter.ai
   */
  private async callOpenRouter(
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.1-8b-instruct:free', // Free model
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://tender-alert.local', // Required by OpenRouter
          'X-Title': 'Tender Alert SaaS',
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const content = response.data.choices[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : null;
  }

  /**
   * Call OpenAI API.
   */
  private async callOpenAI(
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    const response = await this.openaiClient.chat.completions.create({
      model: this.primaryModel,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  }

  /**
   * Call Anthropic Claude API.
   */
  private async callAnthropic(
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return response.data.content[0]?.text || null;
  }

  /**
   * Call Google Gemini API.
   */
  private async callGemini(
    prompt: string,
    maxTokens: number,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return response.data.candidates[0]?.content?.parts[0]?.text || null;
  }

  /**
   * Generate a basic local summary without AI (rule-based fallback).
   */
  private generateLocalSummary(rawText: string): string {
    this.logger.warn('Using local fallback for summarization');

    // Extract key information using regex patterns
    const lines = rawText
      .split(/\n|\.\s+/)
      .filter((line) => line.trim().length > 10);

    // Try to identify key elements
    const what =
      lines.find((l) =>
        /tender|bid|procurement|supply|construction/i.test(l),
      ) ||
      lines[0] ||
      'Tender details not specified';
    const authority =
      lines.find((l) =>
        /department|corporation|government|ministry|authority/i.test(l),
      ) || 'Government authority';
    const budget =
      lines.find((l) =>
        /rs\.?|rupees|crore|lakh|budget|cost|estimated|value/i.test(l),
      ) || 'Budget not specified';
    const deadline =
      lines.find((l) =>
        /deadline|last date|submission|due date|closing/i.test(l),
      ) || 'Deadline not specified';

    return `1. ${what.substring(0, 100)}\n2. ${authority.substring(0, 100)}\n3. ${budget.substring(0, 100)}\n4. ${deadline.substring(0, 100)}`;
  }

  /**
   * Extract structured data locally using regex patterns.
   */
  private extractLocal(rawText: string): StructuredExtraction {
    this.logger.warn('Using local fallback for extraction');

    const text = rawText.toLowerCase();

    // Extract state
    const states = [
      'delhi',
      'maharashtra',
      'karnataka',
      'tamil nadu',
      'uttar pradesh',
      'gujarat',
      'rajasthan',
      'west bengal',
    ];
    const state = states.find((s) => text.includes(s)) || null;

    // Extract category
    const categories = [
      'construction',
      'it equipment',
      'transportation',
      'healthcare',
      'education',
      'infrastructure',
    ];
    const category = categories.find((c) => text.includes(c)) || null;

    // Extract budget
    let budget: number | null = null;
    const budgetMatch = rawText.match(
      /(?:rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|lac)?/i,
    );
    if (budgetMatch) {
      const value = parseFloat(budgetMatch[1].replace(/,/g, ''));
      const unit = budgetMatch[2]?.toLowerCase();
      if (unit?.includes('crore') || unit?.includes('cr')) {
        budget = value * 10000000;
      } else if (unit?.includes('lakh') || unit?.includes('lac')) {
        budget = value * 100000;
      } else {
        budget = value;
      }
    }

    // Extract deadline
    let deadline: string | null = null;
    const dateMatch = rawText.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    );
    if (dateMatch) {
      const monthNames = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
      ];
      const month = monthNames.indexOf(dateMatch[2].toLowerCase()) + 1;
      deadline = `${dateMatch[3]}-${month.toString().padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    }

    return { state, category, budget, deadline };
  }
}
