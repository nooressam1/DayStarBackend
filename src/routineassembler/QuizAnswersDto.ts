import { IsString, IsArray, IsOptional } from 'class-validator';

export class QuizAnswersDto {
    @IsString()
    skinType: string;

    @IsArray()
    @IsString({ each: true })
    concerns: string[];

    @IsString()
    sensitivity: string;

    @IsOptional()
    @IsString()
    sunExposure?: string;

    @IsOptional()
    @IsString()
    time?: string;
}