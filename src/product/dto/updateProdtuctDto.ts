import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVariantDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsOptional()
    size?: string;

    @IsString()
    @IsOptional()
    sku?: string;

    @IsOptional()
    @IsNumber()
    stock?: number;
}

export class UpdateProductDto {
    @IsString()
    @IsOptional()
    name: string;

    @IsString()
    @IsOptional()
    description: string;

    @IsOptional()
    @IsString()
    category_id?: string | null;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    on_sale?: boolean;

    @IsOptional()
    @IsNumber()
    discount_percentage?: number | null;

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
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateVariantDto)
    variants?: UpdateVariantDto[];
}
