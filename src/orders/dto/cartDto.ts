import {
  IsString,
  IsArray,
  IsNumber,
  ValidateNested,
  Min,
  isNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class cartItemDto {
  @IsString()
  variant_id!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}
export class CreateOrderDto {
  @IsString()
  city!: string;

  @IsString()
  area!: string;

  @IsString()
  address!: string; // Street address / building details

  @IsString()
  @IsOptional()
  floorNumber?: string;

  @IsString()
  @IsOptional()
  apartmentNumber?: string;

  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  addressId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => cartItemDto)
  items!: cartItemDto[];

}
