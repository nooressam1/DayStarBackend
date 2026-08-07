import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { discount } from './discount.interface';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Injectable()
export class DiscountService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async getAllDiscounts(): Promise<discount[]> {
    const response = await this.supabaseService.admin
      .from('discount')
      .select('*')
      .order('created_at', { ascending: false });

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return (response.data as discount[]) || [];
  }

  async findbycode(code: string): Promise<discount> {
    const formattedCode = code.trim().toUpperCase();

    const response = await this.supabaseService.admin
      .from('discount')
      .select('*')
      .ilike('code', formattedCode)
      .single();

    if (response.error || !response.data) {
      throw new NotFoundException('Discount not found');
    }
    return response.data as discount;
  }

  async createDiscount(dto: CreateDiscountDto): Promise<discount> {
    const formattedCode = dto.code.trim().toUpperCase();

    // Check code uniqueness in database
    const existing = await this.supabaseService.admin
      .from('discount')
      .select('id')
      .ilike('code', formattedCode)
      .maybeSingle();

    if (existing.data) {
      throw new ConflictException(
        'This discount code already exists. Discount codes cannot be repeated.'
      );
    }

    const payload = {
      code: formattedCode,
      type: dto.type,
      value: dto.value,
      created_at: new Date().toISOString(),
      is_active: dto.is_active ?? true,
      min_requirement_type: dto.min_requirement_type,
      min_requirement_value: dto.min_requirement_value,
      active_start_date: dto.active_start_date,
      active_end_date: dto.active_end_date,
    };

    const response = await this.supabaseService.admin
      .from('discount')
      .insert(payload)
      .select()
      .single();

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return response.data as discount;
  }

  async deleteDiscount(id: string): Promise<{ success: boolean }> {
    const response = await this.supabaseService.admin
      .from('discount')
      .delete()
      .eq('id', id);

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return { success: true };
  }
}