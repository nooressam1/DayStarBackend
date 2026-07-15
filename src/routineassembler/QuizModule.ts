// quiz.module.ts
import { Module } from '@nestjs/common';
import { QuizController } from './Quiz.Controller';
import { SkinProfileService } from '../routineassembler/skinprofile.service';
import { RoutineAssemblerService } from '../routineassembler/routineassembler.service';
import { SupabaseModule } from '../supabase/supabase.module'; // wherever SupabaseService is provided

@Module({
    imports: [SupabaseModule],
    controllers: [QuizController],
    providers: [SkinProfileService, RoutineAssemblerService],
})
export class QuizModule { }