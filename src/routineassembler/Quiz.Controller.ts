// quiz.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { QuizAnswersDto } from './QuizAnswersDto';
import { SkinProfileService } from './skinprofile.service';
import { RoutineAssemblerService } from './routineassembler.service';
import { AiQuizService, ChatRequestDto } from './ai-quiz.service';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { OptionalSupabaseAuthGuard } from '../auth/optional-supabase-auth.guard';
import { Throttle } from '@nestjs/throttler'; // <-- 1. Import Throttle decorator

@Controller('quiz')
export class QuizController {
    constructor(
        private readonly skinProfileService: SkinProfileService,
        private readonly routineAssembler: RoutineAssemblerService,
        private readonly aiQuizService: AiQuizService,
    ) { }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('chat')
    async chatWithAi(@Body() body: ChatRequestDto) {
        console.log('📥 [QuizController] Incoming /quiz/chat payload:', JSON.stringify(body, null, 2));
        return this.aiQuizService.processChat(body);
    }

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('submit')
    @UseGuards(OptionalSupabaseAuthGuard)
    async submitQuiz(@Body() answers: QuizAnswersDto, @CurrentUser() user: any) {
        console.log("reaching here testing", user);

        const profile = {
            user_id: user?.sub ?? null,
            skin_type: answers.skinType,
            concern: answers.concerns,
            sensitivity: answers.sensitivity,
            sun_exposure: answers.sunExposure ?? null,
        };
        console.log("testing profile", profile);

        const savedProfile = await this.skinProfileService.create(profile);
        const fullRoutine = await this.routineAssembler.assembleFullRoutine(savedProfile);

        return fullRoutine;
    }
}