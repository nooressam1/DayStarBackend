// quiz.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizController } from './Quiz.Controller';
import { SkinProfileService } from './skinprofile.service';
import { RoutineAssemblerService } from './routineassembler.service';
import { AiQuizService } from './ai-quiz.service';
import { IngredientService } from './ingredient.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule, ConfigModule],
    controllers: [QuizController],
    providers: [SkinProfileService, RoutineAssemblerService, AiQuizService, IngredientService],
    exports: [IngredientService, RoutineAssemblerService],
})
export class QuizModule { }