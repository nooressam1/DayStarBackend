import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty()
  @IsString()
  street: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  building_no?: string;

  @IsOptional()
  @IsString()
  buildingNo?: string;

  @IsOptional()
  @IsString()
  floor_number?: string;

  @IsOptional()
  @IsString()
  floorNumber?: string;

  @IsOptional()
  @IsString()
  apartment_number?: string;

  @IsOptional()
  @IsString()
  apartmentNumber?: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
