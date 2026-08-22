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

function buildSystemPrompt(profile: {
  skinType?: string;
  concerns?: string[];
  sensitivity?: string;
  goals?: string[];
}): string {
  const hasSkinType = !!profile.skinType;
  const hasConcerns = Array.isArray(profile.concerns) && profile.concerns.length > 0;
  const hasSensitivity = !!profile.sensitivity;
  const hasGoals = Array.isArray(profile.goals) && profile.goals.length > 0;

  // Determine the exact next question to ask
  let nextQuestion: string;
  if (!hasSkinType) {
    nextQuestion = 'Ask: What is your skin type? (oily, dry, combination, normal, or sensitive)';
  } else if (!hasConcerns) {
    nextQuestion = 'Ask: What are your main skin concerns? (acne, pigmentation, aging, redness, dryness — pick all that apply)';
  } else if (!hasSensitivity) {
    nextQuestion = 'Ask: How does your skin react to new products? (very sensitive, sometimes irritated, handles most things well, or unpredictable)';
  } else if (!hasGoals) {
    nextQuestion = 'Ask: What are your skincare goals? (clear acne, smooth fine lines, fade dark spots, calm irritation, intense hydration — pick all that apply)';
  } else {
    nextQuestion = 'All attributes collected. Give a warm 1-sentence summary of their profile and set isComplete to true.';
  }

  return `You are an expert Aesthetician & Skincare Consultant for DayStar Skincare.
You are collecting the user's skin profile through a short conversation.

## CURRENT PROFILE STATE (DO NOT RE-ASK ANYTHING MARKED ✅):
- skinType: ${hasSkinType ? `✅ Already known: "${profile.skinType}"` : '❌ Not yet answered'}
- concerns: ${hasConcerns ? `✅ Already known: [${profile.concerns!.join(', ')}]` : '❌ Not yet answered'}
- sensitivity: ${hasSensitivity ? `✅ Already known: "${profile.sensitivity}"` : '❌ Not yet answered'}
- goals: ${hasGoals ? `✅ Already known: [${profile.goals!.join(', ')}]` : '❌ Not yet answered'}

## YOUR NEXT ACTION:
${nextQuestion}

## RULES:
- Ask ONE question at a time — the next unanswered one only.
- Never re-ask or rephrase anything marked ✅.
- Accept loose language — map it to the closest valid enum value yourself.
- Keep your message to 1-2 sentences. Be warm and concise.
- Extract ANY profile info mentioned in the user's message, even if they answer multiple things at once.

## Valid Enum Values:
- skinType: "oily" | "dry" | "combination" | "normal" | "sensitive"
- concerns: subset of ["acne", "pigmentation", "aging", "redness", "dryness"]
- sensitivity: "highly_sensitive" | "moderately_sensitive" | "resilient" | "unpredictable"
- goals: subset of ["clear_acne", "smooth_lines", "fade_spots", "calm_irritation", "intense_hydration"]

## Response — return ONLY this raw JSON, no markdown:
{
  "message": "Your 1-2 sentence response",
  "extractedProfile": {
    "skinType": "${hasSkinType ? profile.skinType : 'fill if user answered, else empty string'}",
    "concerns": ${hasConcerns ? JSON.stringify(profile.concerns) : '[]'},
    "sensitivity": "${hasSensitivity ? profile.sensitivity : 'fill if user answered, else empty string'}",
    "goals": ${hasGoals ? JSON.stringify(profile.goals) : '[]'}
  },
  "suggestions": ["chip 1", "chip 2", "chip 3"],
  "isComplete": ${hasSkinType && hasConcerns && hasSensitivity && hasGoals}
}`;
}

@Injectable()
export class AiQuizService {
  private readonly logger = new Logger(AiQuizService.name);

  constructor(private readonly groqService: GroqService) { }

  async processChat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    const currentProfile = {
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
        extractedProfile: currentProfile,
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

      // Dynamic system prompt that tells the model exactly what's filled and what to ask next
      const systemPrompt = buildSystemPrompt(currentProfile);

      const messages: GroqChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
      ];

      // Use GroqService to get JSON response
      const parsed = await this.groqService.chatCompletionJson<{
        message?: string;
        extractedProfile?: Partial<ChatResponseDto['extractedProfile']>;
        suggestions?: string[];
        isComplete?: boolean;
      }>(messages);

      // Merge extracted profile on top of current profile (never discard existing values)
      const mergedProfile = {
        skinType: parsed.extractedProfile?.skinType || currentProfile.skinType,
        concerns:
          parsed.extractedProfile?.concerns?.length
            ? Array.from(new Set([...currentProfile.concerns, ...parsed.extractedProfile.concerns]))
            : currentProfile.concerns,
        sensitivity: parsed.extractedProfile?.sensitivity || currentProfile.sensitivity,
        goals:
          parsed.extractedProfile?.goals?.length
            ? Array.from(new Set([...currentProfile.goals, ...(parsed.extractedProfile.goals ?? [])]))
            : currentProfile.goals,
      };

      return {
        message: parsed.message || 'Got it! What are your main skin concerns?',
        extractedProfile: mergedProfile,
        suggestions: parsed.suggestions || ['Oily', 'Dry', 'Combination', 'Sensitive'],
        isComplete: Boolean(parsed.isComplete),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);
      return {
        message: `⚠️ Groq AI Request Failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please verify backend network connectivity and your GROQ_API_KEY.`,
        extractedProfile: currentProfile,
        suggestions: ['Retry'],
        isComplete: false,
      };
    }
  }
}
