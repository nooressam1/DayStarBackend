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

function buildSkinTypePrompt(knownSkinType: string): string {
  return `You are an expert Aesthetician & Skincare Consultant for DayStar Skincare.
Your only task right now is to identify the user's skin type from their messages.

Valid Skin Types:
- "dry" (feels tight, flaky, lacks moisture)
- "oily" (shiny, greasy, prone to excess sebum all over)
- "combination" (shiny T-zone on forehead/nose, but normal or dry on cheeks)
- "sensitive" (easily turns red, stings, reacts to products)
- "normal" (balanced, neither excessively dry nor oily)

CURRENT KNOWN SKIN TYPE: ${knownSkinType ? `"${knownSkinType}"` : 'null (not identified yet)'}

Instructions:
1. Read the user's message.
2. If the user indicates their skin type or describes how their skin feels:
   - Set "skinType" to the matching enum ("dry", "oily", "combination", "sensitive", or "normal").
   - Write a friendly 1-2 sentence response in "message" acknowledging their skin type (e.g., "Got it, dry skin! Let's find products that deeply hydrate and restore your skin barrier.").
   - In "suggestions", provide 3-4 sample skin concerns they might have (e.g. ["Acne", "Dark Spots", "Aging", "Redness"]).
3. If their message is unclear or unrelated to skin type:
   - Keep "skinType" as ""
   - In "message", warmly ask them how their skin feels or what skin type they have.
   - In "suggestions", provide ["Oily", "Dry", "Combination", "Normal", "Sensitive"].

Respond strictly with valid JSON (no markdown, no backticks):
{
  "message": "...",
  "skinType": "dry" | "oily" | "combination" | "sensitive" | "normal" | "",
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;
}

// Fallback keyword matcher for skin type
function detectSkinTypeKeyword(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('combination') || lower.includes('t-zone') || lower.includes('t zone')) return 'combination';
  if (lower.includes('dry') || lower.includes('tight') || lower.includes('flak')) return 'dry';
  if (lower.includes('oily') || lower.includes('greas') || lower.includes('shiny all over')) return 'oily';
  if (lower.includes('sensitive') || lower.includes('stings') || lower.includes('irritat')) return 'sensitive';
  if (lower.includes('normal') || lower.includes('balanced')) return 'normal';
  return '';
}

@Injectable()
export class AiQuizService {
  private readonly logger = new Logger(AiQuizService.name);

  constructor(private readonly groqService: GroqService) { }

  async processChat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    console.log('📥 [AiQuizService] Received DTO:', JSON.stringify(dto, null, 2));

    const currentSkinType = dto?.currentProfile?.skinType || '';
    const currentConcerns = Array.isArray(dto?.currentProfile?.concerns) ? dto.currentProfile.concerns : [];
    const currentSensitivity = dto?.currentProfile?.sensitivity || '';
    const currentGoals = Array.isArray(dto?.currentProfile?.goals) ? dto.currentProfile.goals : [];

    // Check if Groq is configured
    if (!this.groqService.isConfigured()) {
      this.logger.warn('GROQ_API_KEY not found in environment.');
      return {
        message:
          '⚠️ Groq API key is missing. Please set your `GROQ_API_KEY` in `DayStarBackend/.env` (or environment variables) and restart the backend server!',
        extractedProfile: {
          skinType: currentSkinType,
          concerns: currentConcerns,
          sensitivity: currentSensitivity,
          goals: currentGoals,
        },
        suggestions: ['Add GROQ_API_KEY'],
        isComplete: false,
      };
    }

    try {
      // Build conversation messages array
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

      // System prompt focused strictly on skin type
      const systemPrompt = buildSkinTypePrompt(currentSkinType);

      const messages: GroqChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
      ];

      // Groq LLM completion
      const parsed = await this.groqService.chatCompletionJson<{
        message?: string;
        skinType?: string;
        suggestions?: string[];
      }>(messages);

      console.log('🤖 [AiQuizService] Groq Raw Response:', JSON.stringify(parsed, null, 2));

      // Resolve skin type: LLM parsed value -> fallback keyword matcher -> current value
      const latestUserMsg = conversationMessages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      const fallbackType = detectSkinTypeKeyword(latestUserMsg);

      const detectedSkinType = parsed.skinType || fallbackType || currentSkinType;

      const mergedProfile = {
        skinType: detectedSkinType,
        concerns: currentConcerns,
        sensitivity: currentSensitivity,
        goals: currentGoals,
      };

      console.log('📤 [AiQuizService] Resolved Skin Type:', detectedSkinType);
      console.log('📤 [AiQuizService] Returning Merged Profile:', JSON.stringify(mergedProfile, null, 2));

      return {
        message: parsed.message || (detectedSkinType ? `Got it, ${detectedSkinType} skin!` : "What is your skin type?"),
        extractedProfile: mergedProfile,
        suggestions: parsed.suggestions || ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'],
        isComplete: Boolean(detectedSkinType),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);
      return {
        message: `⚠️ Groq AI Request Failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please verify backend network connectivity and your GROQ_API_KEY.`,
        extractedProfile: {
          skinType: currentSkinType,
          concerns: currentConcerns,
          sensitivity: currentSensitivity,
          goals: currentGoals,
        },
        suggestions: ['Retry'],
        isComplete: false,
      };
    }
  }
}
