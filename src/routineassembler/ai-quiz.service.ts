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
  return `You are an expert Aesthetician & Skincare Consultant for DayStar Skincare.
Your goal is to extract the user's skin profile through a friendly conversation, one question at a time.

## CURRENT KNOWN PROFILE:
- skinType: ${profile.skinType ? `"${profile.skinType}"` : 'null (not yet answered)'}
- concerns: ${profile.concerns && profile.concerns.length > 0 ? JSON.stringify(profile.concerns) : '[] (not yet answered)'}
- sensitivity: ${profile.sensitivity ? `"${profile.sensitivity}"` : 'null (not yet answered)'}
- goals: ${profile.goals && profile.goals.length > 0 ? JSON.stringify(profile.goals) : '[] (not yet answered)'}

## INSTRUCTIONS:
1. **EXTRACT**: Look at the entire conversation and especially the user's latest message. Extract ANY information provided:
   - skinType: "oily" | "dry" | "combination" | "normal" | "sensitive" (or preserve existing if already known)
   - concerns: array from ["acne", "pigmentation", "aging", "redness", "dryness"] (accumulate with any previously known)
   - sensitivity: "highly_sensitive" | "moderately_sensitive" | "resilient" | "unpredictable"
   - goals: array from ["clear_acne", "smooth_lines", "fade_spots", "calm_irritation", "intense_hydration"]

2. **DETERMINE NEXT QUESTION**: Look at the updated profile (known + newly extracted):
   - If skinType is missing: Acknowledge politely and ask for skin type.
   - Else if concerns is missing/empty: Acknowledge skin type and ask for main skin concerns (e.g. acne, dark spots, aging, redness, dryness).
   - Else if sensitivity is missing: Acknowledge concerns and ask how their skin reacts to new products or active ingredients.
   - Else if goals is missing/empty: Acknowledge sensitivity and ask what their #1 skincare goal is.
   - If ALL 4 are known: Give a warm 1-2 sentence summary, set isComplete to true, and suggest ["Generate My Routine ✨"].

3. **OUTPUT FORMAT**: Respond ONLY with a valid JSON object in this exact schema (no markdown, no backticks):
{
  "message": "Your 1-2 sentence response acknowledging their input and asking the next question",
  "extractedProfile": {
    "skinType": "oily" | "dry" | "combination" | "normal" | "sensitive" | "",
    "concerns": ["acne", "pigmentation"],
    "sensitivity": "highly_sensitive" | "moderately_sensitive" | "resilient" | "unpredictable" | "",
    "goals": ["clear_acne", "intense_hydration"]
  },
  "suggestions": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "isComplete": false
}`;
}

// Fallback keyword matcher to guarantee extraction even if the LLM misses it
function extractKeywordsFallback(text: string, current: { skinType: string; concerns: string[]; sensitivity: string; goals: string[] }) {
  const lower = text.toLowerCase();
  const res = { ...current };

  if (!res.skinType) {
    if (lower.includes('dry')) res.skinType = 'dry';
    else if (lower.includes('oily') || lower.includes('greasy')) res.skinType = 'oily';
    else if (lower.includes('combination') || lower.includes('t-zone')) res.skinType = 'combination';
    else if (lower.includes('sensitive') || lower.includes('stings') || lower.includes('redness')) res.skinType = 'sensitive';
    else if (lower.includes('normal') || lower.includes('balanced')) res.skinType = 'normal';
  }

  if (lower.includes('acne') || lower.includes('breakout') || lower.includes('pimple')) {
    if (!res.concerns.includes('acne')) res.concerns = [...res.concerns, 'acne'];
  }
  if (lower.includes('dark spot') || lower.includes('pigment') || lower.includes('hyperpigmentation') || lower.includes('sun spot')) {
    if (!res.concerns.includes('pigmentation')) res.concerns = [...res.concerns, 'pigmentation'];
  }
  if (lower.includes('wrinkle') || lower.includes('aging') || lower.includes('fine line')) {
    if (!res.concerns.includes('aging')) res.concerns = [...res.concerns, 'aging'];
  }
  if (lower.includes('redness') || lower.includes('rosacea') || lower.includes('irritat')) {
    if (!res.concerns.includes('redness')) res.concerns = [...res.concerns, 'redness'];
  }
  if (lower.includes('dryness') || lower.includes('flak') || lower.includes('dehydrat')) {
    if (!res.concerns.includes('dryness')) res.concerns = [...res.concerns, 'dryness'];
  }

  if (!res.sensitivity) {
    if (lower.includes('very sensitive') || lower.includes('highly sensitive') || lower.includes('easily irritated')) {
      res.sensitivity = 'highly_sensitive';
    } else if (lower.includes('sometimes') || lower.includes('occasional') || lower.includes('moderate')) {
      res.sensitivity = 'moderately_sensitive';
    } else if (lower.includes('well') || lower.includes('resilient') || lower.includes('rarely') || lower.includes('handles most')) {
      res.sensitivity = 'resilient';
    }
  }

  return res;
}

@Injectable()
export class AiQuizService {
  private readonly logger = new Logger(AiQuizService.name);

  constructor(private readonly groqService: GroqService) { }

  async processChat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    console.log('📥 [AiQuizService] Received DTO:', JSON.stringify(dto, null, 2));
    const currentProfile = {
      skinType: dto?.currentProfile?.skinType || '',
      concerns: Array.isArray(dto?.currentProfile?.concerns) ? dto.currentProfile.concerns : [],
      sensitivity: dto?.currentProfile?.sensitivity || '',
      goals: Array.isArray(dto?.currentProfile?.goals) ? dto.currentProfile.goals : [],
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

      // Dynamic system prompt instructing extraction + next step
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

      console.log('🤖 [AiQuizService] Groq Raw Response:', JSON.stringify(parsed, null, 2));

      // Merge LLM extracted profile on top of current profile
      let mergedProfile = {
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

      // Resilient keyword fallback extraction based on the latest user message
      const latestUserMsg = conversationMessages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      if (latestUserMsg) {
        mergedProfile = extractKeywordsFallback(latestUserMsg, mergedProfile);
      }

      const isComplete = Boolean(
        mergedProfile.skinType &&
        mergedProfile.concerns.length > 0 &&
        mergedProfile.sensitivity
      );

      console.log('📤 [AiQuizService] Returning Merged Profile:', JSON.stringify(mergedProfile, null, 2));

      return {
        message: parsed.message || (isComplete ? "I have all the information to build your routine!" : "Got it! What are your main skin concerns?"),
        extractedProfile: mergedProfile,
        suggestions: parsed.suggestions || (isComplete ? ["Generate My Routine ✨"] : ["Acne", "Dark Spots", "Aging", "Redness"]),
        isComplete: Boolean(parsed.isComplete || isComplete),
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
