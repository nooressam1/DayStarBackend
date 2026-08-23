import { Injectable, Logger } from '@nestjs/common';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GroqService, GroqChatMessage } from '../groq/groq.service';
import { CurrentProfileDto } from './CurrentProfileDto';

export { CurrentProfileDto };

export class ChatMessagePayload {
  @IsString()
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessagePayload)
  messages: ChatMessagePayload[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CurrentProfileDto)
  currentProfile?: CurrentProfileDto;
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

function buildConsultationPrompt(currentProfile: {
  skinType?: string;
  concerns?: string[];
  sensitivity?: string;
  goals?: string[];
}): string {
  const skinType = currentProfile?.skinType || '';
  const concerns = Array.isArray(currentProfile?.concerns) ? currentProfile.concerns : [];
  const sensitivity = currentProfile?.sensitivity || '';
  const goals = Array.isArray(currentProfile?.goals) ? currentProfile.goals : [];

  let currentStage = 'SKIN_TYPE';
  if (!skinType) {
    currentStage = 'SKIN_TYPE';
  } else if (concerns.length === 0) {
    currentStage = 'CONCERNS';
  } else if (!sensitivity) {
    currentStage = 'SENSITIVITY';
  } else {
    currentStage = 'COMPLETE';
  }

  return `You are an expert Aesthetician & Skincare Consultant for DayStar Skincare.
Your mission is to guide the user step-by-step through a friendly consultation to identify their Skin Type, Concerns, and Sensitivity so we can assemble their custom skincare routine.

CURRENT DETECTED PROFILE:
- Skin Type: ${skinType ? `"${skinType}"` : 'null (needed)'}
- Primary Concerns: ${concerns.length > 0 ? JSON.stringify(concerns) : 'null (needed)'}
- Sensitivity: ${sensitivity ? `"${sensitivity}"` : 'null (needed)'}
- Goals: ${goals.length > 0 ? JSON.stringify(goals) : '[]'}
- ACTIVE FOCUS STAGE: ${currentStage}

CONSULTATION STAGES & PROGRESSION:
1. STAGE "SKIN_TYPE" (if Skin Type is null):
   - Identify user's skin type from: "dry" | "oily" | "combination" | "sensitive" | "normal".
   - If identified, set "skinType", acknowledge it warmly in "message", and immediately ask the NEXT question (Stage 2 - Concerns): "What are your main skin concerns (such as acne, dark spots, fine lines, redness, or dryness)?"
   - In "suggestions", provide: ["Acne & Breakouts", "Dark Spots / Pigmentation", "Fine Lines & Aging", "Redness & Irritation", "Dullness & Dryness"]

2. STAGE "CONCERNS" (if Skin Type is known, but Concerns is empty):
   - Extract 1 or more concerns into "concerns" array: valid items are "acne", "pigmentation", "aging", "redness", "dryness".
   - Keep previously identified "skinType".
   - If identified, acknowledge their concerns in "message" and immediately ask the NEXT question (Stage 3 - Sensitivity): "How does your skin typically react to active ingredients or new skincare products?"
   - In "suggestions", provide: ["Resilient (Rarely Reacts)", "Moderately Sensitive", "Very Sensitive (Easily Irritated)"]

3. STAGE "SENSITIVITY" (if Skin Type and Concerns are known, but Sensitivity is null):
   - Identify sensitivity from: "resilient" | "moderately_sensitive" | "highly_sensitive".
   - Keep previous "skinType" and "concerns".
   - If identified, set "sensitivity", celebrate completing their profile in "message", and announce that their custom routine is ready to assemble!
   - In "suggestions", provide: ["✨ Generate My Routine", "Clear Breakouts", "Fade Dark Spots", "Anti-Aging & Firming"]

4. STAGE "COMPLETE" (when Skin Type, Concerns, and Sensitivity are all identified):
   - Enthusiastically summarize their complete profile in "message" (e.g. "We have everything! Your combination skin profile with acne & dark spot focus is ready.")
   - In "suggestions", provide: ["✨ Generate My Routine"]

CRITICAL: ALWAYS respond strictly with a valid JSON object matching this schema (no markdown, no backticks):
{
  "message": "Friendly response acknowledging user's input and asking the next question",
  "skinType": "dry" | "oily" | "combination" | "sensitive" | "normal" | "",
  "concerns": ["acne", "pigmentation", "aging", "redness", "dryness"],
  "sensitivity": "resilient" | "moderately_sensitive" | "highly_sensitive" | "",
  "goals": ["clear_acne", "smooth_lines", "fade_spots", "calm_irritation", "intense_hydration"],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Example 1 (User mentions Skin Type):
User: "I have combination skin"
Response:
{
  "message": "Got it, combination skin! To tailor the right active products for you, what are your primary skin concerns right now?",
  "skinType": "combination",
  "concerns": [],
  "sensitivity": "",
  "goals": [],
  "suggestions": ["Acne & Breakouts", "Dark Spots / Pigmentation", "Fine Lines & Aging", "Redness & Irritation", "Dullness & Dryness"]
}

Example 2 (User mentions Concerns):
User: "Acne and dark spots"
Response:
{
  "message": "Understood, targeting acne and brightening dark spots! Next, how easily does your skin react to new skincare products or active ingredients?",
  "skinType": "combination",
  "concerns": ["acne", "pigmentation"],
  "sensitivity": "",
  "goals": [],
  "suggestions": ["Resilient (Rarely Reacts)", "Moderately Sensitive", "Very Sensitive (Easily Irritated)"]
}

Example 3 (User mentions Sensitivity):
User: "My skin is resilient and rarely reacts"
Response:
{
  "message": "Perfect! Your skincare profile is complete. Click below to assemble and view your tailored DayStar skincare routine!",
  "skinType": "combination",
  "concerns": ["acne", "pigmentation"],
  "sensitivity": "resilient",
  "goals": ["clear_acne", "fade_spots"],
  "suggestions": ["✨ Generate My Routine"]
}`;
}

// Fallback keyword matchers
function detectSkinTypeKeyword(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('combination') || lower.includes('t-zone') || lower.includes('t zone')) return 'combination';
  if (lower.includes('dry') || lower.includes('tight') || lower.includes('flak')) return 'dry';
  if (lower.includes('oily') || lower.includes('greas') || lower.includes('shiny all over')) return 'oily';
  if (lower.includes('sensitive') && !lower.includes('moderately') && !lower.includes('resilient')) return 'sensitive';
  if (lower.includes('normal') || lower.includes('balanced')) return 'normal';
  return '';
}

function detectConcernsKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (lower.includes('acne') || lower.includes('breakout') || lower.includes('pimple') || lower.includes('blemish') || lower.includes('pore') || lower.includes('blackhead')) {
    found.push('acne');
  }
  if (lower.includes('pigment') || lower.includes('dark spot') || lower.includes('sun spot') || lower.includes('melasma') || lower.includes('uneven') || lower.includes('discolor')) {
    found.push('pigmentation');
  }
  if (lower.includes('aging') || lower.includes('wrinkle') || lower.includes('fine line') || lower.includes('firm') || lower.includes('sagging')) {
    found.push('aging');
  }
  if (lower.includes('redness') || lower.includes('rosacea') || lower.includes('irritat') || lower.includes('inflam')) {
    found.push('redness');
  }
  if (lower.includes('dry') || lower.includes('dull') || lower.includes('dehydrat') || lower.includes('radiance') || lower.includes('flak')) {
    found.push('dryness');
  }
  return found;
}

function detectSensitivityKeyword(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('very sensitive') || lower.includes('highly sensitive') || lower.includes('burns') || lower.includes('stings') || lower.includes('easily irritated')) {
    return 'highly_sensitive';
  }
  if (lower.includes('moderately') || lower.includes('moderate') || lower.includes('occasional') || lower.includes('sometimes')) {
    return 'moderately_sensitive';
  }
  if (lower.includes('resilient') || lower.includes('rarely') || lower.includes('not sensitive') || lower.includes('tough') || lower.includes('never reacts')) {
    return 'resilient';
  }
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

    const latestUserMsg = conversationMessages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const fallbackSkinType = detectSkinTypeKeyword(latestUserMsg);
    const fallbackConcerns = detectConcernsKeywords(latestUserMsg);
    const fallbackSensitivity = detectSensitivityKeyword(latestUserMsg);

    try {
      // Dynamic system prompt tailored to current consultation stage
      const systemPrompt = buildConsultationPrompt({
        skinType: currentSkinType,
        concerns: currentConcerns,
        sensitivity: currentSensitivity,
        goals: currentGoals,
      });

      const messages: GroqChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
      ];

      // Groq LLM completion
      const parsed = await this.groqService.chatCompletionJson<{
        message?: string;
        skinType?: string;
        concerns?: string[];
        sensitivity?: string;
        goals?: string[];
        suggestions?: string[];
      }>(messages);

      console.log('🤖 [AiQuizService] Groq Raw Response:', JSON.stringify(parsed, null, 2));

      // Resolve extracted fields
      const detectedSkinType = parsed.skinType || fallbackSkinType || currentSkinType;

      const newConcerns = Array.isArray(parsed.concerns) && parsed.concerns.length > 0
        ? parsed.concerns
        : fallbackConcerns;
      const mergedConcerns = Array.from(new Set([...currentConcerns, ...newConcerns]));

      const detectedSensitivity = parsed.sensitivity || fallbackSensitivity || currentSensitivity;

      const newGoals = Array.isArray(parsed.goals) && parsed.goals.length > 0
        ? parsed.goals
        : [];
      const mergedGoals = Array.from(new Set([...currentGoals, ...newGoals]));

      const mergedProfile = {
        skinType: detectedSkinType,
        concerns: mergedConcerns,
        sensitivity: detectedSensitivity,
        goals: mergedGoals,
      };

      const isComplete = Boolean(
        detectedSkinType &&
        mergedConcerns.length > 0 &&
        detectedSensitivity,
      );

      // Determine smart suggestions based on next missing field
      let defaultSuggestions: string[] = [];
      if (!detectedSkinType) {
        defaultSuggestions = ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];
      } else if (mergedConcerns.length === 0) {
        defaultSuggestions = ['Acne & Breakouts', 'Dark Spots / Pigmentation', 'Fine Lines & Aging', 'Redness & Irritation', 'Dullness & Dryness'];
      } else if (!detectedSensitivity) {
        defaultSuggestions = ['Resilient (Rarely Reacts)', 'Moderately Sensitive', 'Very Sensitive (Easily Irritated)'];
      } else {
        defaultSuggestions = ['✨ Generate My Routine', 'Fade Dark Spots', 'Clear Breakouts', 'Deep Hydration'];
      }

      console.log('📤 [AiQuizService] Resolved Profile:', JSON.stringify(mergedProfile, null, 2));

      return {
        message: parsed.message || (isComplete
          ? 'Your skin profile is complete! Click below to view your tailored routine.'
          : 'Thank you for sharing! Let us continue with the next step.'),
        extractedProfile: mergedProfile,
        suggestions: parsed.suggestions && parsed.suggestions.length > 0
          ? parsed.suggestions
          : defaultSuggestions,
        isComplete,
      };
    } catch (err) {
      this.logger.error('Error in Groq AI processChat:', err);

      // Resilient fallback logic
      const detectedSkinType = fallbackSkinType || currentSkinType;
      const mergedConcerns = Array.from(new Set([...currentConcerns, ...fallbackConcerns]));
      const detectedSensitivity = fallbackSensitivity || currentSensitivity;

      const mergedProfile = {
        skinType: detectedSkinType,
        concerns: mergedConcerns,
        sensitivity: detectedSensitivity,
        goals: currentGoals,
      };

      const isComplete = Boolean(detectedSkinType && mergedConcerns.length > 0 && detectedSensitivity);

      let fallbackMessage = "I'm ready to help! Could you describe how your skin feels (e.g. oily, dry, normal, sensitive, or combination)?";
      let fallbackSuggestions = ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];

      if (!detectedSkinType) {
        fallbackMessage = "What is your skin type or how does your skin feel throughout the day?";
        fallbackSuggestions = ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];
      } else if (mergedConcerns.length === 0) {
        fallbackMessage = `Got it, ${detectedSkinType} skin! What are your primary skin concerns right now?`;
        fallbackSuggestions = ['Acne & Breakouts', 'Dark Spots / Pigmentation', 'Fine Lines & Aging', 'Redness & Irritation', 'Dullness & Dryness'];
      } else if (!detectedSensitivity) {
        fallbackMessage = "Understood! How does your skin typically react to new skincare products or active ingredients?";
        fallbackSuggestions = ['Resilient (Rarely Reacts)', 'Moderately Sensitive', 'Very Sensitive (Easily Irritated)'];
      } else {
        fallbackMessage = "Great! Your skin profile is ready. Click below to generate your custom routine.";
        fallbackSuggestions = ['✨ Generate My Routine'];
      }

      return {
        message: fallbackMessage,
        extractedProfile: mergedProfile,
        suggestions: fallbackSuggestions,
        isComplete,
      };
    }
  }
}
