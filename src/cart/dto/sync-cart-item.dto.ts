import { IsString, IsNumber, Min } from 'class-validator';

export class SyncCartItemDto {
  @IsString()
  variant_id: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
