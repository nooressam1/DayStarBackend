import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  value: number;

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

