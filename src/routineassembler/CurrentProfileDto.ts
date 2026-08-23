import { IsArray, IsOptional, IsString } from 'class-validator';

export class CurrentProfileDto {
  @IsOptional()
  @IsString()
  skinType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concerns?: string[];

  @IsOptional()
  @IsString()
  sensitivity?: string;

  @IsOptional()
  @IsString()
  sunExposure?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];
}
