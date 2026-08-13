import { IsArray, IsString, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GuestCartItemDto {
  @IsString()
  variant_id: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class MergeGuestCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  items: GuestCartItemDto[];
}
