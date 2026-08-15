import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleNotifyDto {
  @IsBoolean()
  notify_on_sale!: boolean;

  @IsOptional()
  @IsString()
  product_id?: string;
}
