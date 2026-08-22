import { Injectable, Logger } from '@nestjs/common';
import { GroqService, GroqChatMessage } from '../groq/groq.service';

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

const SKINCARE_SYSTEM_PROMPT = `You are Groq AI, an expert Aesthetician & Skincare Consultant for DayStar Skincare.
Your job is to have a friendly, professional conversation to determine the user's skin profile.

## CONVERSATION FLOW — follow these steps IN ORDER:
1. **Skin Type** — Ask about their skin type. Once answered, move on. NEVER ask again.
2. **Concerns** — Ask what skin concerns they have. Once answered, move on. NEVER ask again.
3. **Sensitivity** — Ask how their skin reacts to new products. Once answered, move on. NEVER ask again.
4. **Goals** — Ask what their skincare goals are. Once answered, move on. NEVER ask again.
5. **Complete** — Once you have all 4 attributes, set isComplete to true and give a brief encouraging summary.

## CRITICAL RULES:
- NEVER repeat or rephrase a question the user has already answered.
- If the user's answer gives you info for the current step, FILL that field and IMMEDIATELY ask the NEXT step's question.
- If the user provides multiple attributes in one message, fill them all and skip to the next unanswered step.
- Keep your messages short (2-3 sentences max). Be warm but efficient.

## Valid Values:
- skinType: "oily" | "dry" | "combination" | "normal" | "sensitive"
- concerns: subset of ["acne", "pigmentation", "aging", "redness", "dryness"]
- sensitivity: "highly_sensitive" | "moderately_sensitive" | "resilient" | "unpredictable"
- goals: subset of ["clear_acne", "smooth_lines", "fade_spots", "calm_irritation", "intense_hydration"]

## Response Format (strict JSON only):
{
  "message": "Your conversational response — ask the NEXT unanswered question only.",
  "extractedProfile": {
    "skinType": "detected value or empty string",
    "concerns": ["detected values or empty array"],
    "sensitivity": "detected value or empty string",
    "goals": ["detected values or empty array"]
  },
  "suggestions": ["3-4 short clickable quick-reply chips relevant to the CURRENT question"],
  "isComplete": false
}
Return raw JSON only. No markdown, no code fences.`;

@Injectable()
export class AiQuizService {
  private readonly logger = new Logger(AiQuizService.name);

  constructor(private readonly groqService: GroqService) { }

  async processChat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    const fallbackProfile = {
      skinType: dto?.currentProfile?.skinType || '',
      concerns: dto?.currentProfile?.concerns || [],
      sensitivity: dto?.currentProfile?.sensitivity || '',
      goals: dto?.currentProfile?.goals || [],
    };

    // Check if Groq is configured
    if (!this.groqService.isConfigured()) {
      this.logger.warn('GROQ_API_KEY not found in environment.');
      return {
        message:
          '⚠️ Groq API key is missing. Please set your `GROQ_API_KEY` in `DayStarBackend/.env` (or environment variables) and restart the backend server!',
        extractedProfile: fallbackProfile,
        suggestions: ['Add GROQ_API_KEY'],
        isComplete: false,
      };
    }

    try {
      // Build messages array
      const rawMessages = Array.isArray(dto?.messages)
        ? dto.messages
        : Array.isArray((dto as any)?.body?.messages)
          ? (dto as any).body.messages
          : [];

      const conversationMessages: GroqChatMessage[] = rawMessages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
        .map((m) => ({
          role: (m.role === 'assistant' || (m as any).sender === 'ai'
            ? 'assistant'
            : 'user') as 'user' | 'assistant',
          content: m.content,
        }));

      const messages: GroqChatMessage[] = [
        { role: 'system', content: SKINCARE_SYSTEM_PROMPT },
        ...conversationMessages,
      ];

      // Use GroqService to get JSON response
      const parsed = await this.groqService.chatCompletionJson<{
        message?: string;
        extractedProfile?: Partial<ChatResponseDto['extractedProfile']>;
        suggestions?: string[];
        isComplete?: boolean;
      }>(messages);

      return {
        message:
          parsed.message ||
          'Thank you for sharing! Could you tell me if your skin reacts easily to new ingredients?',
        extractedProfile: {
          skinType: parsed.extractedProfile?.skinType || fallbackProfile.skinType,
          concerns: parsed.extractedProfile?.concerns || fallbackProfile.concerns,
          sensitivity: parsed.extractedProfile?.sensitivity || fallbackProfile.sensitivity,
          goals: parsed.extractedProfile?.goals || fallbackProfile.goals,
        },
        suggestions: parsed.suggestions || [
          'Sensitive skin',
          'Resilient skin',
          'Occasional breakouts',
        ],
        isComplete: Boolean(parsed.isComplete),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);
      return {
        message: `⚠️ Groq AI Request Failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please verify backend network connectivity and your GROQ_API_KEY.`,
        extractedProfile: fallbackProfile,
        suggestions: ['Retry'],
        isComplete: false,
      };
    }
  }
}
