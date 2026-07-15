import { IsString, IsArray } from 'class-validator';

export class QuizAnswersDto {
    @IsString()
    skinType: string;

    @IsArray()
    @IsString({ each: true })
    concerns: string[];

    @IsString()
    sensitivity: string;
}