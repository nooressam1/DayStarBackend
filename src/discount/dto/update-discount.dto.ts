import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  min_requirement_type?: string;

  @IsOptional()
  @IsNumber()
  min_requirement_value?: number;

  @IsOptional()
  @IsString()
  active_start_date?: string;

  @IsOptional()
  @IsString()
  active_end_date?: string;
}
