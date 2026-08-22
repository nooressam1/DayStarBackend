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
    const modelName = this.configService.get<string>('GROQ_MODEL') || process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';

    if (!groqApiKey || groqApiKey.trim() === '') {
      this.logger.warn('GROQ_API_KEY not found in environment.');
      return {
        message: "⚠️ Groq API key is missing. Please set your `GROQ_API_KEY` in `DayStarBackend/.env` and restart the backend server to activate Groq AI!",
        extractedProfile: {
          skinType: dto?.currentProfile?.skinType || '',
          concerns: dto?.currentProfile?.concerns || [],
          sensitivity: dto?.currentProfile?.sensitivity || '',
          goals: dto?.currentProfile?.goals || [],
        },
        suggestions: ["Add GROQ_API_KEY in .env"],
        isComplete: false,
      };
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

      const rawMessages = Array.isArray(dto?.messages)
        ? dto.messages
        : Array.isArray((dto as any)?.body?.messages)
        ? (dto as any).body.messages
        : [];

      const formattedMessages: ChatMessagePayload[] = rawMessages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
        .map((m) => ({
          role: m.role === 'assistant' || (m as any).sender === 'ai' ? 'assistant' : 'user',
          content: m.content,
        }));

      const payloadMessages: ChatMessagePayload[] = [systemPrompt, ...formattedMessages];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: payloadMessages,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Groq API error status ${res.status}: ${errorText}`);
        return {
          message: `⚠️ Groq API Connection Error (Status ${res.status}). Please check that your GROQ_API_KEY in DayStarBackend/.env is valid.`,
          extractedProfile: {
            skinType: dto?.currentProfile?.skinType || '',
            concerns: dto?.currentProfile?.concerns || [],
            sensitivity: dto?.currentProfile?.sensitivity || '',
            goals: dto?.currentProfile?.goals || [],
          },
          suggestions: ["Check GROQ_API_KEY"],
          isComplete: false,
        };
      }

      const data = await res.json();
      const contentStr = data.choices?.[0]?.message?.content;

      if (!contentStr) {
        return {
          message: "Empty response received from Groq AI. Please try sending your message again.",
          extractedProfile: {
            skinType: dto?.currentProfile?.skinType || '',
            concerns: dto?.currentProfile?.concerns || [],
            sensitivity: dto?.currentProfile?.sensitivity || '',
            goals: dto?.currentProfile?.goals || [],
          },
          suggestions: ["Try Again"],
          isComplete: false,
        };
      }

      const parsed = JSON.parse(contentStr);

      return {
        message: parsed.message || "Thank you for sharing! Could you tell me if your skin reacts easily to new ingredients?",
        extractedProfile: {
          skinType: parsed.extractedProfile?.skinType || dto?.currentProfile?.skinType || '',
          concerns: parsed.extractedProfile?.concerns || dto?.currentProfile?.concerns || [],
          sensitivity: parsed.extractedProfile?.sensitivity || dto?.currentProfile?.sensitivity || '',
          goals: parsed.extractedProfile?.goals || dto?.currentProfile?.goals || [],
        },
        suggestions: parsed.suggestions || ["Sensitive skin", "Resilient skin", "Occasional breakouts"],
        isComplete: Boolean(parsed.isComplete),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);
      return {
        message: `⚠️ Groq AI Request Failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please verify backend network connectivity and your GROQ_API_KEY.`,
        extractedProfile: {
          skinType: dto?.currentProfile?.skinType || '',
          concerns: dto?.currentProfile?.concerns || [],
          sensitivity: dto?.currentProfile?.sensitivity || '',
          goals: dto?.currentProfile?.goals || [],
        },
        suggestions: ["Retry"],
        isComplete: false,
      };
    }
  }
}
