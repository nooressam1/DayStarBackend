// quiz.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { QuizAnswersDto } from './QuizAnswersDto';
import { SkinProfileService } from './skinprofile.service';
import { RoutineAssemblerService } from './routineassembler.service';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { OptionalSupabaseAuthGuard } from '../auth/optional-supabase-auth.guard';

@Controller('quiz')
export class QuizController {
    constructor(
        private readonly skinProfileService: SkinProfileService,
        private readonly routineAssembler: RoutineAssemblerService,
    ) { }

    @Post('submit')
    @UseGuards(OptionalSupabaseAuthGuard)
    async submitQuiz(@Body() answers: QuizAnswersDto, @CurrentUser() user: any) {
        console.log("reaching here testing", user);

        const profile = {
            user_id: user?.sub ?? null,
            skin_type: answers.skinType,
            concern: answers.concerns,
            sensitivity: answers.sensitivity,
        };
        console.log("testing profile", profile);

        const savedProfile = await this.skinProfileService.create(profile);
        const routine = await this.routineAssembler.assembleRoutine(savedProfile);

        return routine;
    }
}