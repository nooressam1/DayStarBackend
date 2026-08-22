import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ChatRequestDto {
  messages: ChatMessagePayload[];
  currentProfile?: {
    skinType?: string;
    concerns?: string[];
    sensitivity?: string;
    goals?: string[];
  };
}

export interface ChatResponseDto {
  message: string;
  extractedProfile: {
    skinType: string;
    concerns: string[];
    sensitivity: string;
    goals: string[];
  };
  suggestions: string[];
  isComplete: boolean;
}

@Injectable()
export class AiQuizService {
  private readonly logger = new Logger(AiQuizService.name);

  constructor(private readonly configService: ConfigService) {}

  async processChat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      this.logger.warn('GROQ_API_KEY not found in environment.');
      throw new Error('GROQ_API_KEY is not configured on the backend.');
    }

    try {
      const systemPrompt: ChatMessagePayload = {
        role: 'system',
        content: `You are Groq AI, an expert Aesthetician & Skincare Consultant for DayStar Skincare.
Your task is to conversationally consult with the user, determine their skin attributes, and output a structured JSON evaluation.

Valid Schema Enums:
- skinType: "oily" | "dry" | "combination" | "normal" | "sensitive"
- concerns: Array subset of ["acne", "pigmentation", "aging", "redness", "dryness"]
- sensitivity: "highly_sensitive" | "moderately_sensitive" | "resilient" | "unpredictable"
- goals: Array subset of ["clear_acne", "smooth_lines", "fade_spots", "calm_irritation", "intense_hydration"]

Response Instructions:
You MUST respond strictly with a JSON object containing:
{
  "message": "Your friendly, expert conversational response asking clarifying questions or offering advice.",
  "extractedProfile": {
    "skinType": "string or empty string",
    "concerns": ["string array"],
    "sensitivity": "string or empty string",
    "goals": ["string array"]
  },
  "suggestions": ["3-4 short clickable quick reply chips for the user"],
  "isComplete": boolean (true only if skinType, concerns, and sensitivity are identified)
}
Return raw JSON object only.`,
      };

      const payloadMessages = [systemPrompt, ...dto.messages];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: payloadMessages,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Groq API error status ${res.status}: ${errorText}`);
        throw new Error(`Groq API returned error status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const contentStr = data.choices?.[0]?.message?.content;

      if (!contentStr) {
        throw new Error('Groq API returned an empty response content.');
      }

      const parsed = JSON.parse(contentStr);

      return {
        message: parsed.message || "Thank you for sharing! Could you tell me if your skin reacts easily to new ingredients?",
        extractedProfile: {
          skinType: parsed.extractedProfile?.skinType || dto.currentProfile?.skinType || '',
          concerns: parsed.extractedProfile?.concerns || dto.currentProfile?.concerns || [],
          sensitivity: parsed.extractedProfile?.sensitivity || dto.currentProfile?.sensitivity || '',
          goals: parsed.extractedProfile?.goals || dto.currentProfile?.goals || [],
        },
        suggestions: parsed.suggestions || ["Sensitive skin", "Resilient skin", "Occasional breakouts"],
        isComplete: Boolean(parsed.isComplete),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);
      throw err;
    }
  }
}
