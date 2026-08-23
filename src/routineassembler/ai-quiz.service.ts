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
1. If the user mentions how their skin feels or states their skin type:
   - Set "skinType" to the matching enum ("dry", "oily", "combination", "sensitive", or "normal").
   - Write a friendly 1-2 sentence response in "message" acknowledging their skin type (e.g. "Got it, dry skin! Let's find products that deeply hydrate and restore your skin barrier.").
   - In "suggestions", provide 3-4 skin concerns they might want to address next (e.g. ["Acne & Blemishes", "Dark Spots", "Anti-Aging", "Redness"]).
2. If the user's message is a greeting (e.g., "hi", "hello"), vague, or does not indicate skin type yet:
   - Set "skinType" to ""
   - In "message", warmly greet them and ask how their skin feels or what skin type they have.
   - In "suggestions", provide ["Oily", "Dry", "Combination", "Normal", "Sensitive"].

CRITICAL: You MUST ALWAYS respond in pure JSON format matching this schema:
{
  "message": "string",
  "skinType": "dry" | "oily" | "combination" | "sensitive" | "normal" | "",
  "suggestions": ["string"]
}

Example 1 (User Greeting):
User: "Hello"
Response:
{
  "message": "Hello! I'm your DayStar AI Skincare Consultant. How does your skin feel throughout the day?",
  "skinType": "",
  "suggestions": ["Oily", "Dry", "Combination", "Normal", "Sensitive"]
}

Example 2 (User describes skin):
User: "My forehead is shiny and oily but my cheeks are dry"
Response:
{
  "message": "That describes combination skin! Let's build a balanced routine to hydrate your cheeks while controlling T-zone shine.",
  "skinType": "combination",
  "suggestions": ["Acne & Blemishes", "Enlarged Pores", "Hyperpigmentation", "Dullness"]
}`;
}

// Fallback keyword matcher for skin type
function detectSkinTypeKeyword(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('combination') || lower.includes('t-zone') || lower.includes('t zone')) return 'combination';
  if (lower.includes('dry') || lower.includes('tight') || lower.includes('flak')) return 'dry';
  if (lower.includes('oily') || lower.includes('greas') || lower.includes('shiny all over')) return 'oily';
  if (lower.includes('sensitive') || lower.includes('stings') || lower.includes('irritat') || lower.includes('redness')) return 'sensitive';
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

    const latestUserMsg = conversationMessages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const fallbackType = detectSkinTypeKeyword(latestUserMsg);

    try {
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
        message: parsed.message || (detectedSkinType ? `Got it, ${detectedSkinType} skin!` : "Could you tell me how your skin feels or what skin type you have?"),
        extractedProfile: mergedProfile,
        suggestions: parsed.suggestions && parsed.suggestions.length > 0
          ? parsed.suggestions
          : (detectedSkinType
            ? ['Acne & Blemishes', 'Dark Spots', 'Anti-Aging', 'Dryness']
            : ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive']),
        isComplete: Boolean(detectedSkinType),
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);

      // Fallback gracefully so the user experience is never interrupted
      const detectedSkinType = fallbackType || currentSkinType;
      const mergedProfile = {
        skinType: detectedSkinType,
        concerns: currentConcerns,
        sensitivity: currentSensitivity,
        goals: currentGoals,
      };

      return {
        message: detectedSkinType
          ? `Got it, looks like you have ${detectedSkinType} skin! What are your primary skin concerns?`
          : "I'm ready to help! Could you describe how your skin feels (e.g. oily, dry, normal, sensitive, or combination)?",
        extractedProfile: mergedProfile,
        suggestions: detectedSkinType
          ? ['Acne & Blemishes', 'Dark Spots', 'Anti-Aging', 'Hydration']
          : ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'],
        isComplete: Boolean(detectedSkinType),
      };
    }
  }
}
