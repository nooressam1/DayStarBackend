import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatOptions {
  /** Model ID to use. Falls back to GROQ_MODEL env var, then to the default. */
  model?: string;
  /** Sampling temperature (0–2). Default: 0.7 */
  temperature?: number;
  /** Maximum tokens in the response. */
  maxTokens?: number;
  /** Force JSON output from the model. Default: false */
  jsonMode?: boolean;
}

export interface GroqChatChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string;
}

export interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GROQ_API_KEY') ||
      process.env.GROQ_API_KEY ||
      '';
    this.defaultModel =
      this.configService.get<string>('GROQ_MODEL') ||
      process.env.GROQ_MODEL ||
      DEFAULT_MODEL;
  }

  /** Check whether the Groq API key is configured. */
  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  /**
   * Send a chat completion request to the Groq Cloud API.
   *
   * @param messages  The conversation messages (system + user + assistant history).
   * @param options   Optional overrides for model, temperature, etc.
   * @returns         The raw Groq API response.
   * @throws          An error with a descriptive message on failure.
   */
  async chatCompletion(
    messages: GroqChatMessage[],
    options: GroqChatOptions = {},
  ): Promise<GroqChatResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'GROQ_API_KEY is not configured. Set it in your .env file and restart the server.',
      );
    }

    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    this.logger.log(`Groq chat request → model: ${model}, messages: ${messages.length}`);

    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Groq API ${res.status}: ${errorText}`);
      throw new Error(`Groq API Error (${res.status}): ${errorText}`);
    }

    const data: GroqChatResponse = await res.json();
    this.logger.log(
      `Groq response ← model: ${data.model}, tokens: ${data.usage?.total_tokens ?? '?'}`,
    );

    return data;
  }

  /**
   * Convenience wrapper: send messages and get back just the assistant's text content.
   */
  async chatCompletionText(
    messages: GroqChatMessage[],
    options: GroqChatOptions = {},
  ): Promise<string> {
    const data = await this.chatCompletion(messages, options);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq AI.');
    }
    return content;
  }

  /**
   * Convenience wrapper: send messages and parse the response as JSON.
   * Automatically enables jsonMode.
   */
  async chatCompletionJson<T = unknown>(
    messages: GroqChatMessage[],
    options: GroqChatOptions = {},
  ): Promise<T> {
    const text = await this.chatCompletionText(messages, {
      ...options,
      jsonMode: true,
    });
    return JSON.parse(text) as T;
  }
}
