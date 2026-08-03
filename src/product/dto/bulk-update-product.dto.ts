import { IsArray, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class BulkUpdateProductDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsBoolean()
  on_sale?: boolean;

  @IsOptional()
  @IsNumber()
  discount_percentage?: number | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skin_type?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concern?: string[];

  @IsOptional()
  @IsString()
  step_type?: string;

  @IsOptional()
  @IsString()
  category_id?: string;
}
